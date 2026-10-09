"""In-process sliding-window rate limits. Per API process: run one worker, or move this to Redis to scale out."""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def limit(key: str, max_calls: int, window_s: int) -> None:
    """Allow `max_calls` per `window_s` seconds for `key`; otherwise 429 with Retry-After."""
    now = time.monotonic()
    with _lock:
        hits = _hits[key]
        while hits and now - hits[0] >= window_s:
            hits.popleft()
        if len(hits) >= max_calls:
            retry = int(window_s - (now - hits[0])) + 1
            raise HTTPException(429, f"Too many requests. Try again in {retry} seconds.", headers={"Retry-After": str(retry)})
        hits.append(now)


def reset() -> None:
    with _lock:
        _hits.clear()
