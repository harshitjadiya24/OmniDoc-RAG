"""User accounts in SQLite with bcrypt password hashes."""

import re
import sqlite3
import uuid
from contextlib import closing
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import bcrypt

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 10


class AccountError(ValueError):
    pass


@dataclass(frozen=True)
class User:
    id: str
    email: str
    created_at: str


class UserStore:
    def __init__(self, path: Path):
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,"
                " password_hash BLOB NOT NULL, created_at TEXT NOT NULL)"
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        return conn

    def register(self, email: str, password: str) -> User:
        email = email.strip().lower()
        if not EMAIL.match(email):
            raise AccountError("Enter a valid email address.")
        if len(password) < MIN_PASSWORD:
            raise AccountError(f"Use a password of at least {MIN_PASSWORD} characters.")
        user = User(f"usr_{uuid.uuid4().hex[:16]}", email, datetime.now(UTC).isoformat(timespec="seconds"))
        digest = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        try:
            with closing(self._connect()) as conn, conn:
                conn.execute("INSERT INTO users VALUES (?,?,?,?)", (user.id, user.email, digest, user.created_at))
        except sqlite3.IntegrityError as exc:
            raise AccountError("An account with this email already exists.") from exc
        return user

    def authenticate(self, email: str, password: str) -> User | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        if row is None or not bcrypt.checkpw(password.encode(), row["password_hash"]):
            return None
        return User(row["id"], row["email"], row["created_at"])

    def get(self, user_id: str) -> User | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT id, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
        return User(row["id"], row["email"], row["created_at"]) if row else None
