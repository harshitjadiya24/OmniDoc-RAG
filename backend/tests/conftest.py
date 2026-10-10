import pytest

from src.config import settings


@pytest.fixture(autouse=True)
def no_hosted_models(monkeypatch):
    """Settings load backend/.env, so a developer's real API keys would otherwise reach hosted models from tests
    (spending the free-tier quota and waiting on it). Every test starts on Ollama with no hosted keys."""
    monkeypatch.setattr(settings, "LLM_PROVIDER", "ollama")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(settings, "MISTRAL_API_KEY", "")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
