"""Signed, expiring session tokens and the FastAPI dependency that resolves the caller."""

from functools import lru_cache

from fastapi import Header, HTTPException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from src.auth.users import User, UserStore
from src.config import settings

LOCAL_USER = User("local", "local", "")
SALT = "regrag-session"


@lru_cache(maxsize=1)
def user_store() -> UserStore:
    return UserStore(settings.LIBRARY_DIR / "users.db")


def _serializer() -> URLSafeTimedSerializer:
    if not settings.SECRET_KEY:
        raise RuntimeError("AUTH_ENABLED is true but SECRET_KEY is empty. Set a long random SECRET_KEY.")
    return URLSafeTimedSerializer(settings.SECRET_KEY, salt=SALT)


def issue_token(user: User) -> str:
    return _serializer().dumps(user.id)


def current_user(authorization: str | None = Header(default=None)) -> User:
    """With auth off every caller is the single local user. With auth on, a valid Bearer token is required."""
    if not settings.AUTH_ENABLED:
        return LOCAL_USER
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to use your documents.", headers={"WWW-Authenticate": "Bearer"})
    try:
        user_id = _serializer().loads(authorization[7:].strip(), max_age=settings.SESSION_HOURS * 3600)
    except SignatureExpired as exc:
        raise HTTPException(401, "Your session expired. Sign in again.") from exc
    except BadSignature as exc:
        raise HTTPException(401, "Sign in to use your documents.") from exc
    user = user_store().get(str(user_id))
    if user is None:
        raise HTTPException(401, "This account no longer exists.")
    return user


def optional_user(authorization: str | None = Header(default=None)) -> User | None:
    """The caller if signed in (or the local user when auth is off), else None. For public endpoints."""
    if not settings.AUTH_ENABLED:
        return LOCAL_USER
    if not authorization:
        return None
    return current_user(authorization)
