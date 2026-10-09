"""One interface for the answer model: local Ollama (default) or Google Gemini.

Gemini is offered only when its API key is configured; nothing leaves the machine otherwise.
"""

import json
import urllib.request
from dataclasses import asdict, dataclass

from src.config import Settings

PROVIDERS = ("ollama", "gemini")


class ProviderUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderInfo:
    id: str
    label: str
    model: str
    available: bool
    reason: str | None
    local: bool

    def to_dict(self) -> dict:
        return asdict(self)


def _ollama_has(settings: Settings) -> tuple[bool, str | None]:
    try:
        with urllib.request.urlopen(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=1.5) as res:
            names = {m.get("name") for m in json.load(res).get("models", [])}
    except OSError:
        return False, f"Ollama is not reachable at {settings.OLLAMA_BASE_URL}."
    if settings.OLLAMA_MODEL not in names:
        return False, f"Ollama is running but the model {settings.OLLAMA_MODEL} is not pulled."
    return True, None


def provider_info(settings: Settings) -> list[ProviderInfo]:
    ollama_ok, ollama_reason = _ollama_has(settings)
    return [
        ProviderInfo("ollama", "Local (Ollama)", settings.OLLAMA_MODEL, ollama_ok, ollama_reason, True),
        ProviderInfo(
            "gemini",
            "Gemini (Google)",
            settings.GEMINI_MODEL,
            bool(settings.GEMINI_API_KEY),
            None if settings.GEMINI_API_KEY else "Set GEMINI_API_KEY on the server to enable.",
            False,
        ),
    ]


QUICK_TOKENS = 64
SUMMARY_TOKENS = 2500  # enough for a long 1-2 page summary plus a few example questions


def chat_model(provider: str, settings: Settings, *, quick: bool = False, summarize: bool = False):
    """A LangChain chat model with temperature 0 and a hard output cap.

    `quick` is for one-line utility calls (query rewrite): reasoning off, tiny cap.
    `summarize` is for the upload summary: reasoning off (a reasoning model loops on
    the JSON prompt) with a medium cap. Raises ProviderUnavailable with a user-facing reason."""
    limit = QUICK_TOKENS if quick else SUMMARY_TOKENS if summarize else settings.LLM_MAX_TOKENS
    reasoning_off = quick or summarize
    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=settings.OLLAMA_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0,
            num_predict=limit,
            **({"reasoning": False} if reasoning_off else {}),
        )
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ProviderUnavailable("Set GEMINI_API_KEY on the server to use Gemini.")
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL, google_api_key=settings.GEMINI_API_KEY, temperature=0, max_output_tokens=limit
        )
    raise ProviderUnavailable(f"Unknown provider: {provider}.")


def failure_message(exc: Exception) -> str:
    """A short, user-facing reason an answer model call failed (the provider's own message when it has one)."""
    body = getattr(exc, "body", None)
    detail = body.get("error", {}).get("message") if isinstance(body, dict) else None
    reason = " ".join(str(detail or exc).split())[:300] or type(exc).__name__
    return f"The answer model could not respond: {reason}"


def default_chat_model(settings: Settings | None = None):
    """The configured answer model (LLM_PROVIDER), for code paths without a per-request choice."""
    from src.config import settings as configured

    return chat_model((settings or configured).LLM_PROVIDER, settings or configured)


def model_label(provider: str, settings: Settings) -> str:
    model = {"ollama": settings.OLLAMA_MODEL, "gemini": settings.GEMINI_MODEL}
    return f"{provider}:{model.get(provider, '?')}"
