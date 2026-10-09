"""SQLite registry for uploaded documents, their chunks and page text."""

import json
import sqlite3
from contextlib import closing
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from src.docqa.chunking import Chunk

_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, filename TEXT NOT NULL,
  title TEXT NOT NULL, page_count INTEGER NOT NULL, chunk_count INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL, uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL, page INTEGER NOT NULL, section TEXT, text TEXT NOT NULL,
  PRIMARY KEY (doc_id, ordinal)
);
CREATE TABLE IF NOT EXISTS pages (
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page INTEGER NOT NULL, text TEXT NOT NULL,
  PRIMARY KEY (doc_id, page)
);
"""

# Columns added after Phase 13; existing libraries are migrated in place.
_ADDED_COLUMNS = {
    "doc_type": "TEXT NOT NULL DEFAULT 'other'",
    "type_confidence": "REAL NOT NULL DEFAULT 0",
    "type_signals": "TEXT NOT NULL DEFAULT '[]'",
    "issuer": "TEXT",
    "doc_date": "TEXT",
    "reference": "TEXT",
    "supersedes": "TEXT NOT NULL DEFAULT '[]'",
    "edited": "TEXT NOT NULL DEFAULT '[]'",
    "ocr_pages": "INTEGER NOT NULL DEFAULT 0",
    "summary": "TEXT",
    "example_questions": "TEXT NOT NULL DEFAULT '[]'",
}
_LIST_FIELDS = {"type_signals", "supersedes", "edited", "example_questions"}


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    sha256: str
    filename: str
    title: str
    page_count: int
    chunk_count: int
    size_bytes: int
    uploaded_at: str
    doc_type: str = "other"
    type_confidence: float = 0.0
    type_signals: tuple[str, ...] = ()
    issuer: str | None = None
    doc_date: str | None = None
    reference: str | None = None
    supersedes: tuple[str, ...] = ()
    edited: tuple[str, ...] = field(default=())
    ocr_pages: int = 0
    summary: str | None = None
    example_questions: tuple[str, ...] = ()


@dataclass(frozen=True)
class StoredChunk:
    doc_id: str
    ordinal: int
    page: int
    section: str | None
    text: str

    @property
    def key(self) -> str:
        return f"{self.doc_id}:{self.ordinal}"


def _record(row: sqlite3.Row) -> DocumentRecord:
    data = dict(row)
    for name in _LIST_FIELDS:
        data[name] = tuple(json.loads(data[name] or "[]"))
    return DocumentRecord(**data)


def _encode(name: str, value: Any) -> Any:
    return json.dumps(list(value)) if name in _LIST_FIELDS else value


class DocumentStore:
    def __init__(self, path: Path):
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.executescript(_SCHEMA)
            have = {row["name"] for row in conn.execute("PRAGMA table_info(documents)")}
            for name, decl in _ADDED_COLUMNS.items():
                if name not in have:
                    conn.execute(f"ALTER TABLE documents ADD COLUMN {name} {decl}")

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def add(self, record: DocumentRecord, chunks: list[Chunk], pages: dict[int, str]) -> None:
        data = {k: _encode(k, v) for k, v in asdict(record).items()}
        columns = ", ".join(data)
        with closing(self._connect()) as conn, conn:
            conn.execute(f"INSERT INTO documents ({columns}) VALUES ({', '.join('?' * len(data))})", tuple(data.values()))
            self._insert_chunks(conn, record.id, chunks)
            conn.executemany(
                "INSERT INTO pages VALUES (?,?,?)",
                [(record.id, page, text) for page, text in pages.items()],
            )

    @staticmethod
    def _insert_chunks(conn: sqlite3.Connection, doc_id: str, chunks: list[Chunk]) -> None:
        conn.executemany(
            "INSERT INTO chunks VALUES (?,?,?,?,?)",
            [(doc_id, c.ordinal, c.page, c.section, c.text) for c in chunks],
        )

    def update(self, doc_id: str, fields: dict[str, object]) -> None:
        if not fields:
            return
        allowed = set(DocumentRecord.__dataclass_fields__) - {"id", "sha256"}
        unknown = set(fields) - allowed
        if unknown:
            raise ValueError(f"Unknown fields: {sorted(unknown)}")
        assignments = ", ".join(f"{name} = ?" for name in fields)
        values = [_encode(k, v) for k, v in fields.items()]
        with closing(self._connect()) as conn, conn:
            conn.execute(f"UPDATE documents SET {assignments} WHERE id = ?", (*values, doc_id))

    def replace_chunks(self, doc_id: str, chunks: list[Chunk]) -> None:
        with closing(self._connect()) as conn, conn:
            conn.execute("DELETE FROM chunks WHERE doc_id = ?", (doc_id,))
            self._insert_chunks(conn, doc_id, chunks)
            conn.execute("UPDATE documents SET chunk_count = ? WHERE id = ?", (len(chunks), doc_id))

    def add_pages(self, doc_id: str, pages: dict[int, str]) -> None:
        with closing(self._connect()) as conn, conn:
            conn.executemany(
                "INSERT OR IGNORE INTO pages VALUES (?,?,?)",
                [(doc_id, page, text) for page, text in pages.items()],
            )

    def delete(self, doc_id: str) -> bool:
        with closing(self._connect()) as conn, conn:
            return conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,)).rowcount > 0

    def get(self, doc_id: str) -> DocumentRecord | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return _record(row) if row else None

    def by_hash(self, sha256: str) -> DocumentRecord | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT * FROM documents WHERE sha256 = ?", (sha256,)).fetchone()
        return _record(row) if row else None

    def list_documents(self) -> list[DocumentRecord]:
        with closing(self._connect()) as conn:
            rows = conn.execute("SELECT * FROM documents ORDER BY uploaded_at DESC").fetchall()
        return [_record(row) for row in rows]

    def page_text(self, doc_id: str, page: int) -> str:
        """Full text of one page plus any chunk that starts on it (chunks can run onto the next page)."""
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT text FROM pages WHERE doc_id = ? AND page = ?", (doc_id, page)).fetchone()
            chunks = conn.execute(
                "SELECT text FROM chunks WHERE doc_id = ? AND page = ? ORDER BY ordinal", (doc_id, page)
            ).fetchall()
        parts = ([row["text"]] if row else []) + [c["text"] for c in chunks]
        return "\n".join(parts)

    def all_chunks(self) -> list[StoredChunk]:
        with closing(self._connect()) as conn:
            rows = conn.execute("SELECT doc_id, ordinal, page, section, text FROM chunks ORDER BY doc_id, ordinal").fetchall()
        return [StoredChunk(**row) for row in rows]

    def document_text(self, doc_id: str) -> str:
        """The document's chunk text, in order, for summarisation."""
        with closing(self._connect()) as conn:
            rows = conn.execute("SELECT text FROM chunks WHERE doc_id = ? ORDER BY ordinal", (doc_id,)).fetchall()
        return "\n".join(r["text"] for r in rows)
