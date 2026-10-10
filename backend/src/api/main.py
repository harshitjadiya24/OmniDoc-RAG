"""
FastAPI backend for RegRAG: upload PDFs and ask questions about them.

Endpoints:
  POST /ask/stream   → SSE contract (stages, plan, evidence, answer, citation checks)
  GET  /api/health   → health check
Documents, auth and provider routes live in src/api/*.py routers.
"""

from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.api.auth import router as auth_router
from src.api.chats import router as chats_router
from src.api.library import router as documents_router
from src.api.limits import limit
from src.api.llm import router as llm_router
from src.auth.session import optional_user
from src.auth.users import User
from src.config import settings
from src.observability.logging import configure as configure_logging

app = FastAPI(
    title="RegRAG API",
    version="2.0.0",
    description="Upload PDFs and ask questions with hybrid retrieval, verified citations and version lineage.",
)

app.include_router(documents_router)
app.include_router(llm_router)
app.include_router(auth_router)
app.include_router(chats_router)
configure_logging(app, settings.LOG_JSON)

if settings.AUTH_ENABLED and len(settings.SECRET_KEY) < 32:
    raise RuntimeError("AUTH_ENABLED needs SECRET_KEY of at least 32 characters (e.g. `openssl rand -hex 32`).")

app.add_middleware(
    CORSMiddleware,
    # Only the configured frontend origins (CORS_ORIGINS, comma separated) may call the API from a browser.
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    """A question against the caller's uploaded documents."""

    question: str = Field(..., min_length=3, max_length=2000)
    mode: Literal["dense", "bm25", "hybrid"] = "hybrid"
    rerank: bool = True
    # The documents to search. An empty list (or omitted) means all of the caller's documents.
    document_ids: list[str] | None = None
    # "compare" needs exactly two document_ids; "ask" lets the planner choose single or multi.
    task: Literal["ask", "compare"] = "ask"
    # rewrite adds model-suggested keywords to the BM25 query; provider picks the answer model.
    rewrite: bool = False
    provider: Literal["ollama", "openrouter", "mistral", "groq", "gemini"] | None = None
    # Optional chat ID to continue a conversation thread.
    chat_id: str | None = None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ask/stream")
def ask_stream(req: AskRequest, user: User | None = Depends(optional_user)) -> StreamingResponse:
    """Stream the stage-aware, flattened evidence contract used by the UI."""
    from src.api.library import library_for
    from src.docqa.stream import stream_library_events
    from src.llm.providers import ProviderUnavailable, QuotaExceeded, chat_model, check_quota, model_label

    if user is None:
        raise HTTPException(401, "Sign in to ask about your documents.", headers={"WWW-Authenticate": "Bearer"})
    limit(f"ask:{user.id}", settings.ASK_PER_MINUTE, 60)

    scope = set(req.document_ids) if req.document_ids else None
    if req.task == "compare" and (scope is None or len(scope) != 2):
        raise HTTPException(422, "Compare needs exactly two documents.")

    provider = req.provider or settings.LLM_PROVIDER
    try:
        llm = chat_model(provider, settings)
        rewriter = chat_model(provider, settings, quick=True)
    except ProviderUnavailable as exc:
        raise HTTPException(422, str(exc)) from exc
    try:
        check_quota(provider, settings)
    except QuotaExceeded as exc:
        raise HTTPException(429, str(exc), headers={"Retry-After": str(exc.retry_after)}) from exc

    from src.api.chats import chat_store_for

    history = []
    if req.chat_id:
        chat = chat_store_for(user.id).get(req.chat_id)
        if chat:
            history = chat.messages

    return StreamingResponse(
        stream_library_events(
            library_for(user.id),
            llm,
            req.question,
            scope,
            req.task,
            mode=req.mode,
            rerank=req.rerank,
            rewrite=req.rewrite,
            model=model_label(provider, settings),
            rewriter=rewriter,
            history=history,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
