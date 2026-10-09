"""Which answer models this server can use: GET /llm/providers."""

from fastapi import APIRouter

from src.config import settings
from src.llm.providers import provider_info

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/providers")
def providers() -> dict:
    return {"default": settings.LLM_PROVIDER, "providers": [p.to_dict() for p in provider_info(settings)]}
