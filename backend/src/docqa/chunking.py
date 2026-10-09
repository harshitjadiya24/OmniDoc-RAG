"""Page-aware chunking that tracks the nearest preceding section heading."""

import re
from collections.abc import Callable
from dataclasses import dataclass

from src.docqa.extract import Block

# Clause numbers are short ("10", "4.2.1"); a 4-digit segment is a year or a date ("2021 dated", "02.09.2022").
_NUMBERED = re.compile(r"^(?:chapter|section|part|article)?\s*\d{1,3}(?:\.\d{1,3})*[.)]?\s+\S", re.IGNORECASE)
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


@dataclass(frozen=True)
class Chunk:
    ordinal: int
    page: int
    section: str | None
    text: str


def is_heading(text: str) -> bool:
    if len(text) > 100 or text.endswith((".", ",", ";")):
        return False
    words = text.split()
    if not words or len(words) > 14:
        return False
    return bool(_NUMBERED.match(text)) or (text.isupper() and len(words) <= 10)


def _split_oversized(text: str, limit: int) -> list[str]:
    pieces: list[str] = []
    current = ""
    for sentence in _SENTENCE.split(text):
        while len(sentence) > limit:
            if current:
                pieces.append(current)
                current = ""
            pieces.append(sentence[:limit])
            sentence = sentence[limit:]
        if current and len(current) + len(sentence) + 1 > limit:
            pieces.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        pieces.append(current)
    return pieces


def table_pieces(text: str, limit: int) -> list[str]:
    """Split a rendered table by rows, repeating the header row so each piece stands alone."""
    header, *rows = text.split("\n")
    pieces: list[str] = []
    current: list[str] = []
    for row in rows:
        if current and len(header) + sum(len(r) + 1 for r in current) + len(row) > limit:
            pieces.append("\n".join([header, *current]))
            current = []
        current.append(row)
    pieces.append("\n".join([header, *current]))
    return pieces


def chunk_blocks(
    blocks: list[Block],
    target: int = 900,
    overlap: int = 120,
    heading: Callable[[str], bool] = is_heading,
    stop_at: re.Pattern[str] | None = None,
) -> list[Chunk]:
    """Pack blocks into chunks under their nearest heading. Indexing stops at a `stop_at` heading
    (for example a paper's reference list)."""
    chunks: list[Chunk] = []
    section: str | None = None
    buffer = ""
    buffer_page = 1
    buffer_section: str | None = None

    def flush() -> None:
        nonlocal buffer
        text = buffer.strip()
        if text:
            chunks.append(Chunk(len(chunks), buffer_page, buffer_section, text))
        tail = text[-overlap:] if overlap and len(text) > overlap else ""
        buffer = tail.split(" ", 1)[-1] if tail else ""

    for block in blocks:
        if stop_at is not None and stop_at.match(block.text):
            break
        if block.kind == "table":
            if buffer.strip():
                flush()
                buffer = ""
            for piece in table_pieces(block.text, target):
                chunks.append(Chunk(len(chunks), block.page, section, piece))
            continue
        if heading(block.text):
            if buffer.strip():
                flush()
                buffer = ""
            section = block.text
            continue
        for piece in _split_oversized(block.text, target):
            if buffer and len(buffer) + len(piece) + 1 > target:
                flush()
            if not buffer:
                buffer_page, buffer_section = block.page, section
            buffer = f"{buffer} {piece}".strip()
    if buffer.strip():
        flush()
    return chunks
