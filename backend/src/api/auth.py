"""Accounts: GET /auth/config, POST /auth/register, POST /auth/login, GET /auth/me."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from src.api.limits import limit
from src.auth.session import current_user, issue_token, user_store
from src.auth.users import AccountError, User
from src.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=200)


class SessionOut(BaseModel):
    token: str
    email: str


def _enabled() -> None:
    if not settings.AUTH_ENABLED:
        raise HTTPException(404, "Accounts are turned off on this server.")


@router.get("/config")
def config() -> dict:
    return {"auth_enabled": settings.AUTH_ENABLED}


@router.post("/register", response_model=SessionOut, status_code=201)
def register(body: Credentials, request: Request) -> SessionOut:
    _enabled()
    limit(f"register:{request.client.host if request.client else '?'}", 5, 3600)
    try:
        user = user_store().register(body.email, body.password)
    except AccountError as exc:
        raise HTTPException(422, str(exc)) from exc
    return SessionOut(token=issue_token(user), email=user.email)


@router.post("/login", response_model=SessionOut)
def login(body: Credentials, request: Request) -> SessionOut:
    _enabled()
    limit(f"login:{request.client.host if request.client else '?'}", 10, 300)
    user = user_store().authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(401, "Email or password is wrong.")
    return SessionOut(token=issue_token(user), email=user.email)


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "auth_enabled": settings.AUTH_ENABLED}
