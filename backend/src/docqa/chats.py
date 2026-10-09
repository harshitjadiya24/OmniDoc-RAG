"""Per-user chat sessions and their question/answer turns, in SQLite.

One store lives in each user's library directory, so chats are scoped and durable
the same way uploaded documents are.
"""

import json
import sqlite3
import uuid
from contextlib import closing
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  question TEXT NOT NULL, answer TEXT NOT NULL, refused INTEGER NOT NULL DEFAULT 0,
  sources TEXT NOT NULL DEFAULT '[]', citations TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_by_chat ON messages(chat_id, created_at);
"""

TITLE_MAX = 80


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


@dataclass(frozen=True)
class Message:
    id: str
    question: str
    answer: str
    refused: bool
    sources: list
    citations: list
    created_at: str


@dataclass(frozen=True)
class Chat:
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0
    messages: list[Message] = field(default_factory=list)


class ChatStore:
    def __init__(self, path: Path):
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.executescript(_SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def create(self, title: str = "New chat") -> Chat:
        title = " ".join(title.split())[:TITLE_MAX] or "New chat"
        now = _now()
        chat = Chat(f"chat_{uuid.uuid4().hex[:12]}", title, now, now)
        with closing(self._connect()) as conn, conn:
            conn.execute("INSERT INTO chats VALUES (?,?,?,?)", (chat.id, chat.title, now, now))
        return chat

    def list(self) -> list[Chat]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS n "
                "FROM chats c ORDER BY c.updated_at DESC"
            ).fetchall()
        return [Chat(r["id"], r["title"], r["created_at"], r["updated_at"], r["n"]) for r in rows]

    def get(self, chat_id: str) -> Chat | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
            if row is None:
                return None
            msgs = conn.execute("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at", (chat_id,)).fetchall()
        messages = [
            Message(
                m["id"],
                m["question"],
                m["answer"],
                bool(m["refused"]),
                json.loads(m["sources"] or "[]"),
                json.loads(m["citations"] or "[]"),
                m["created_at"],
            )
            for m in msgs
        ]
        return Chat(row["id"], row["title"], row["created_at"], row["updated_at"], len(messages), messages)

    def add_message(
        self, chat_id: str, question: str, answer: str, refused: bool, sources: list, citations: list
    ) -> Message | None:
        now = _now()
        msg = Message(f"msg_{uuid.uuid4().hex[:12]}", question, answer, refused, sources, citations, now)
        with closing(self._connect()) as conn, conn:
            chat = conn.execute("SELECT title FROM chats WHERE id = ?", (chat_id,)).fetchone()
            if chat is None:
                return None
            conn.execute(
                "INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)",
                (msg.id, chat_id, question, answer, int(refused), json.dumps(sources), json.dumps(citations), now),
            )
            # The first question names the chat; later turns just bump its updated_at.
            if chat["title"] == "New chat":
                conn.execute(
                    "UPDATE chats SET title = ?, updated_at = ? WHERE id = ?",
                    (" ".join(question.split())[:TITLE_MAX], now, chat_id),
                )
            else:
                conn.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (now, chat_id))
        return msg

    def delete(self, chat_id: str) -> bool:
        with closing(self._connect()) as conn, conn:
            cur = conn.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
            conn.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
        return cur.rowcount > 0
