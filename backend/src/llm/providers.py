"""One interface for the answer model: local Ollama (default), OpenRouter, Mistral, Groq or Google Gemini.

Hosted models are offered only when their API key is configured; nothing leaves the machine otherwise.
"""

import json
import urllib.request
from dataclasses import asdict, dataclass

from src.config import Settings
from src.llm.quota import CHARS_PER_TOKEN, BudgetCallback, QuotaExceeded, TokenBudget, budget_for

PROVIDERS = ("ollama", "openrouter", "mistral", "groq", "gemini")


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
            "openrouter",
            "OpenRouter",
            settings.OPENROUTER_MODEL,
            bool(settings.OPENROUTER_API_KEY),
            None if settings.OPENROUTER_API_KEY else "Set OPENROUTER_API_KEY on the server to enable.",
            False,
        ),
        ProviderInfo(
            "mistral",
            "Mistral",
            settings.MISTRAL_MODEL,
            bool(settings.MISTRAL_API_KEY),
            None if settings.MISTRAL_API_KEY else "Set MISTRAL_API_KEY on the server to enable.",
            False,
        ),
        ProviderInfo(
            "groq",
            "Groq",
            settings.GROQ_MODEL,
            bool(settings.GROQ_API_KEY),
            None if settings.GROQ_API_KEY else "Set GROQ_API_KEY on the server to enable.",
            False,
        ),
        ProviderInfo(
            "gemini",
            "Gemini (Google)",
            settings.GEMINI_MODEL,
            bool(settings.GEMINI_API_KEY),
            None if settings.GEMINI_API_KEY else "Set GEMINI_API_KEY on the server to enable.",
            False,
        ),
    ]


OPENROUTER_URL = "https://openrouter.ai/api/v1"
QUICK_TOKENS = 64
# A typical question's prompt (instructions plus retrieved excerpts), used for the up-front quota check.
ASK_PROMPT_TOKENS = 3000
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
    if provider == "openrouter":
        if not settings.OPENROUTER_API_KEY:
            raise ProviderUnavailable("Set OPENROUTER_API_KEY on the server to use OpenRouter.")
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.OPENROUTER_MODEL,
            api_key=settings.OPENROUTER_API_KEY,
            base_url=OPENROUTER_URL,
            temperature=0,
            max_tokens=limit,
            # Reasoning tokens count against max_tokens and add seconds before the first word; answers don't need them.
            extra_body={"reasoning": {"enabled": False}, "models": openrouter_models(settings)},
            default_headers={"X-Title": "OmniDoc"},
        )
    if provider == "mistral":
        if not settings.MISTRAL_API_KEY:
            raise ProviderUnavailable("Set MISTRAL_API_KEY on the server to use Mistral.")
        from langchain_mistralai import ChatMistralAI

        return ChatMistralAI(model=settings.MISTRAL_MODEL, api_key=settings.MISTRAL_API_KEY, temperature=0, max_tokens=limit)
    if provider == "groq":
        if not settings.GROQ_API_KEY:
            raise ProviderUnavailable("Set GROQ_API_KEY on the server to use Groq.")
        from langchain_groq import ChatGroq

        limit = min(limit, settings.GROQ_MAX_TOKENS)
        budget = groq_budget(settings)
        # Background summaries wait for room in the budget; a question fails fast with a retry time.
        callbacks = [BudgetCallback(budget, limit, wait_up_to=90 if summarize else 0)] if budget else None
        return ChatGroq(
            model=settings.GROQ_MODEL, api_key=settings.GROQ_API_KEY, temperature=0, max_tokens=limit, callbacks=callbacks
        )
    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ProviderUnavailable("Set GEMINI_API_KEY on the server to use Gemini.")
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL, google_api_key=settings.GEMINI_API_KEY, temperature=0, max_output_tokens=limit
        )
    raise ProviderUnavailable(f"Unknown provider: {provider}.")


def openrouter_models(settings: Settings) -> list[str]:
    """The model plus its fallbacks, for OpenRouter's in-request routing (at most 3 models are accepted)."""
    fallbacks = [m.strip() for m in settings.OPENROUTER_FALLBACK_MODELS.split(",") if m.strip()]
    return list(dict.fromkeys([settings.OPENROUTER_MODEL, *fallbacks]))[:3]


def groq_budget(settings: Settings) -> TokenBudget | None:
    return budget_for(
        "Groq", settings.GROQ_TOKENS_PER_MINUTE, settings.GROQ_REQUESTS_PER_DAY, settings.GROQ_OUTPUT_TOKENS_PER_MINUTE
    )


def check_quota(provider: str, settings: Settings) -> None:
    """Raise QuotaExceeded when a typical question would not fit the provider's free-tier budget right now."""
    budget = groq_budget(settings) if provider == "groq" else None
    if budget is None:
        return
    output = min(settings.LLM_MAX_TOKENS, settings.GROQ_MAX_TOKENS)
    wait = budget.wait_time(ASK_PROMPT_TOKENS + output, output)
    if wait > 0:
        raise budget.exceeded(wait)


def summary_chars(provider: str, settings: Settings) -> int | None:
    """How much document text the upload summary may send: a Groq request must fit its per-minute token budget."""
    if provider != "groq" or settings.GROQ_TOKENS_PER_MINUTE <= 0:
        return None
    room = settings.GROQ_TOKENS_PER_MINUTE - min(SUMMARY_TOKENS, settings.GROQ_MAX_TOKENS)
    return room * CHARS_PER_TOKEN * 7 // 10  # 70%: the token estimate is rough


def failure_message(exc: Exception) -> str:
    """A short, user-facing reason an answer model call failed (the provider's own message when it has one)."""
    if isinstance(exc, QuotaExceeded):
        return str(exc)
    body = getattr(exc, "body", None)
    detail = body.get("error", {}).get("message") if isinstance(body, dict) else None
    reason = " ".join(str(detail or exc).split())[:300] or type(exc).__name__
    return f"The answer model could not respond: {reason}"


def default_chat_model(settings: Settings | None = None):
    """The configured answer model (LLM_PROVIDER), for code paths without a per-request choice."""
    from src.config import settings as configured

    return chat_model((settings or configured).LLM_PROVIDER, settings or configured)


def model_label(provider: str, settings: Settings) -> str:
    model = {
        "ollama": settings.OLLAMA_MODEL,
        "openrouter": settings.OPENROUTER_MODEL,
        "mistral": settings.MISTRAL_MODEL,
        "groq": settings.GROQ_MODEL,
        "gemini": settings.GEMINI_MODEL,
    }
    return f"{provider}:{model.get(provider, '?')}"
