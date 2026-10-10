import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, LLMResult

from src.api.main import app
from src.config import Settings
from src.llm import providers, quota
from src.llm.quota import BudgetCallback, QuotaExceeded, TokenBudget


class Clock:
    def __init__(self):
        self.now = 1000.0
        self.slept: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


@pytest.fixture(autouse=True)
def fresh_budgets():
    quota.reset()
    yield
    quota.reset()


def budget(clock: Clock, tpm: int = 8000, rpd: int = 1000) -> TokenBudget:
    return TokenBudget("Groq", tpm, rpd, clock=clock, sleep=clock.sleep)


def test_tokens_refill_continuously_and_a_request_over_budget_says_when_to_retry():
    clock = Clock()
    b = budget(clock)
    b.acquire(6000)
    with pytest.raises(QuotaExceeded, match="Try again in 30 seconds") as exc:
        b.acquire(6000)  # 2000 left; 4000 more refill in 30 s at 8000 per minute
    assert exc.value.retry_after == 30
    clock.now += 30
    b.acquire(6000)
    assert b.wait_time(8000) == pytest.approx(60)


def test_background_work_waits_for_room_instead_of_failing():
    clock = Clock()
    b = budget(clock)
    b.acquire(7000)
    b.acquire(3000, wait_up_to=90)
    assert clock.slept == [pytest.approx(15)]


def test_a_request_larger_than_the_budget_only_needs_a_full_bucket():
    clock = Clock()
    b = budget(clock)
    assert b.wait_time(20_000) == 0
    b.acquire(20_000)
    assert b.wait_time(1) > 0


def test_requests_per_day_are_capped():
    clock = Clock()
    b = budget(clock, rpd=2)
    b.acquire(10)
    b.acquire(10)
    with pytest.raises(QuotaExceeded, match="24 hours"):
        b.acquire(10)
    clock.now += quota.DAY_S
    b.acquire(10)


def test_the_callback_charges_estimated_prompt_tokens_plus_the_output_cap():
    clock = Clock()
    b = budget(clock)
    BudgetCallback(b, max_tokens=1000).on_chat_model_start({}, [[HumanMessage("x" * 3000)]])
    assert b.wait_time(8000) == pytest.approx((1000 + 1000) * 60 / 8000)


def test_output_used_in_the_last_minute_plus_the_next_cap_must_fit_like_groq_counts_it():
    clock = Clock()
    b = TokenBudget("Groq", 8000, 1000, output_per_minute=1000, clock=clock, sleep=clock.sleep)
    callback = BudgetCallback(b, max_tokens=1000)
    callback.on_chat_model_start({}, [[HumanMessage("question")]])
    answer = ChatGeneration(
        message=AIMessage("answer", usage_metadata={"input_tokens": 9, "output_tokens": 256, "total_tokens": 265})
    )
    callback.on_llm_end(LLMResult(generations=[[answer]]))
    # Groq's own answer for this case: "Used 256, Requested 1000", retry after 16 seconds.
    with pytest.raises(QuotaExceeded) as exc:
        callback.on_chat_model_start({}, [[HumanMessage("question")]])
    assert exc.value.retry_after == 16
    clock.now += 16
    callback.on_chat_model_start({}, [[HumanMessage("question")]])


def test_groq_caps_output_at_its_free_tier_limit_and_spends_the_shared_budget():
    s = Settings(GROQ_API_KEY="gsk-test", LLM_MAX_TOKENS=2048, GROQ_MAX_TOKENS=1000)
    llm = providers.chat_model("groq", s)
    assert llm.max_tokens == 1000
    assert providers.chat_model("groq", s, summarize=True).max_tokens == 1000
    assert [type(c) for c in llm.callbacks] == [BudgetCallback]
    assert providers.chat_model("groq", Settings(GROQ_API_KEY="gsk-test", GROQ_TOKENS_PER_MINUTE=0)).callbacks is None


def test_groq_summaries_send_only_what_fits_the_minute_budget():
    s = Settings(GROQ_TOKENS_PER_MINUTE=8000, GROQ_MAX_TOKENS=1000)
    assert providers.summary_chars("groq", s) == 14_700
    assert providers.summary_chars("ollama", s) is None


def test_a_question_over_the_groq_budget_is_refused_up_front(monkeypatch):
    from src.config import settings

    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk-test")
    monkeypatch.setattr(settings, "GROQ_TOKENS_PER_MINUTE", 8000)
    providers.groq_budget(settings).acquire(7000)
    res = TestClient(app).post("/ask/stream", json={"question": "what is the fee", "document_ids": [], "provider": "groq"})
    assert res.status_code == 429
    assert "Groq free-tier limit" in res.json()["detail"] and int(res.headers["Retry-After"]) > 0
