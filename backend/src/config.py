import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory is the backend root (2 levels up from this file)
BASE_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    DATA_DIR: Path = BASE_DIR / "data"

    # Ingestion and retrieval for uploaded PDFs
    LIBRARY_DIR: Path = DATA_DIR / "library"
    MAX_UPLOAD_MB: int = 50
    MAX_PDF_PAGES: int = 1500
    OCR_MAX_PAGES: int = 30  # image-only pages OCRed per upload; 0 turns OCR off
    EXTRACT_TABLES: bool = True
    RERANK_MODEL: str = "Xenova/ms-marco-MiniLM-L-6-v2"

    # Deployment: accounts, browser origins, abuse limits, logs
    AUTH_ENABLED: bool = False
    SECRET_KEY: str = ""
    SESSION_HOURS: int = 24 * 7
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ASK_PER_MINUTE: int = 20
    UPLOADS_PER_HOUR: int = 30
    LOG_JSON: bool = True

    # Answer model: ollama (local, default) or gemini
    LLM_PROVIDER: str = "ollama"
    OLLAMA_MODEL: str = "qwen3:1.7b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    # Hard cap on generated tokens. Reasoning models can loop; without a cap one request ran past 19,000 tokens.
    LLM_MAX_TOKENS: int = 2048
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-pro"

    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
settings.LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
