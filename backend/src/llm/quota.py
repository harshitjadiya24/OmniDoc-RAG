"""App-wide budget for a hosted model's free-tier quota (Groq).

Groq enforces three limits per API key, all measured here the way Groq measures them:
- tokens per minute: each request is charged its prompt tokens plus its full max_tokens when it
  starts, and the budget refills continuously;
- output tokens per minute: the output actually generated in the last minute plus the new
  request's max_tokens must fit;
- requests per day.
Mirroring them lets the app refuse a question up front ("try again in 16 seconds") instead of
failing mid-answer, and lets background upload summaries wait their turn. The budget is shared by
every user of the key. In-process, like src/api/limits.py: run one API worker.
"""

import math
import time
from collections import deque
from collections.abc import Callable
from threading import Lock

from langchain_core.callbacks import BaseCallbackHandler

DAY_S = 86_400
# Rough characters per token for English prose. It overestimates (5,415 characters were 1,212 Groq tokens),
# which is the safe direction: an underestimate would let Groq refuse instead of us.
CHARS_PER_TOKEN = 3


class QuotaExceeded(RuntimeError):
    def __init__(self, message: str, retry_after: int):
        super().__init__(message)
        self.retry_after = retry_after


class TokenBudget:
    """Continuously refilling token and output-token budgets plus a rolling per-day request count."""

    def __init__(
        self,
        label: str,
        tokens_per_minute: int,
        requests_per_day: int,
        output_per_minute: int = 0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.label = label
        self.capacity = tokens_per_minute
        self.requests_per_day = requests_per_day
        self.output_capacity = output_per_minute
        self._clock = clock
        self._sleep = sleep
        self._tokens = float(tokens_per_minute)
        self._output_used = 0.0
        self._at = clock()
        self._requests: deque[float] = deque()
        self._lock = Lock()

    def _refill(self, now: float) -> None:
        elapsed = now - self._at
        self._tokens = min(self.capacity, self._tokens + elapsed * self.capacity / 60)
        self._output_used = max(0.0, self._output_used - elapsed * self.output_capacity / 60)
        self._at = now
        while self._requests and now - self._requests[0] >= DAY_S:
            self._requests.popleft()

    def _wait(self, cost: int, output: int, now: float) -> float:
        if self.requests_per_day and len(self._requests) >= self.requests_per_day:
            return DAY_S - (now - self._requests[0])
        # A request larger than a whole budget only needs that budget full; the provider then decides.
        wait = max(0.0, (min(cost, self.capacity) - self._tokens) * 60 / self.capacity)
        if self.output_capacity:
            over = self._output_used + min(output, self.output_capacity) - self.output_capacity
            wait = max(wait, over * 60 / self.output_capacity)
        return wait

    def wait_time(self, cost: int, output: int = 0) -> float:
        """Seconds until a request of `cost` tokens with an `output` cap fits; 0 when it fits now."""
        with self._lock:
            now = self._clock()
            self._refill(now)
            return self._wait(cost, output, now)

    def acquire(self, cost: int, output: int = 0, wait_up_to: float = 0) -> None:
        """Spend `cost` tokens and one request, sleeping up to `wait_up_to` seconds for room."""
        while True:
            with self._lock:
                now = self._clock()
                self._refill(now)
                wait = self._wait(cost, output, now)
                if wait <= 0:
                    self._tokens -= cost
                    self._requests.append(now)
                    return
            if wait > wait_up_to:
                raise self.exceeded(wait)
            self._sleep(wait)

    def record_output(self, tokens: int) -> None:
        """Count output a finished request actually generated against the per-minute output budget."""
        with self._lock:
            self._refill(self._clock())
            self._output_used += tokens

    def exceeded(self, wait: float) -> QuotaExceeded:
        retry = math.ceil(wait)
        if retry < 120:
            when = f"{retry} seconds"
        elif retry < 3600:
            when = f"{math.ceil(retry / 60)} minutes"
        else:
            when = f"{math.ceil(retry / 3600)} hours"
        return QuotaExceeded(f"The {self.label} free-tier limit is used up for now. Try again in {when}.", retry)


class BudgetCallback(BaseCallbackHandler):
    """Charges each chat call to the budget before it is sent (estimated prompt tokens plus the output cap)
    and records the output it actually generated once it ends."""

    raise_error = True

    def __init__(self, budget: TokenBudget, max_tokens: int, wait_up_to: float = 0):
        self.budget = budget
        self.max_tokens = max_tokens
        self.wait_up_to = wait_up_to

    def on_chat_model_start(self, serialized, messages, **kwargs) -> None:
        chars = sum(len(str(m.content)) for batch in messages for m in batch)
        self.budget.acquire(math.ceil(chars / CHARS_PER_TOKEN) + self.max_tokens, self.max_tokens, self.wait_up_to)

    def on_llm_end(self, response, **kwargs) -> None:
        usage = getattr(getattr(response.generations[0][0], "message", None), "usage_metadata", None) or {}
        # Unknown usage counts as the whole cap, so the budget never runs ahead of the provider's.
        self.budget.record_output(usage.get("output_tokens", self.max_tokens))

    def on_llm_error(self, error, **kwargs) -> None:
        # A failed or interrupted stream may still have generated output; count a partial cap conservatively.
        self.budget.record_output(self.max_tokens // 2)


_budgets: dict[str, TokenBudget] = {}
_budgets_lock = Lock()


def budget_for(label: str, tokens_per_minute: int, requests_per_day: int, output_per_minute: int = 0) -> TokenBudget | None:
    """The shared budget for a provider, or None when its limits are turned off (0 tokens per minute)."""
    if tokens_per_minute <= 0:
        return None
    limits = (tokens_per_minute, requests_per_day, output_per_minute)
    with _budgets_lock:
        budget = _budgets.get(label)
        if budget is None or (budget.capacity, budget.requests_per_day, budget.output_capacity) != limits:
            budget = _budgets[label] = TokenBudget(label, *limits)
        return budget


def reset() -> None:
    with _budgets_lock:
        _budgets.clear()
