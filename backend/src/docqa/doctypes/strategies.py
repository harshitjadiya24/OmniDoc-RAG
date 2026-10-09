"""Per-type ingestion and answering strategy, plus cleaning that every type gets."""

import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass

from src.docqa.chunking import is_heading
from src.docqa.extract import Block

_TOC_LINE = re.compile(r"(?:\.{4,}|…{2,}|(?:\. ){4,})\s*\d{1,4}\s*$")
_ROMAN_CHAPTER = re.compile(r"^(?:chapter|part|annex(?:ure)?|schedule|appendix)\s+[ivxlc\d]+\b", re.IGNORECASE)
_PAPER_SECTION = re.compile(
    r"^(?:\d+(?:\.\d+)*\.?\s+)?(?:abstract|introduction|background|related work|method(?:s|ology)?|"
    r"experiments?|results|discussion|conclusions?|limitations|acknowledg(?:e)?ments|appendix)\b",
    re.IGNORECASE,
)
_CONTRACT_SECTION = re.compile(r"^(?:article|clause|schedule|exhibit|recitals|whereas)\b", re.IGNORECASE)
_STEP = re.compile(r"^(?:step\s+\d+|\d+\.\s+[A-Z])", re.IGNORECASE)
_REFERENCES = re.compile(r"^(?:\d+\.?\s+)?(?:references|bibliography|works cited)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class Strategy:
    label: str
    heading: Callable[[str], bool]
    target: int
    stop_at: re.Pattern[str] | None
    rules: str


def _short(text: str) -> bool:
    return len(text) <= 100 and not text.endswith((".", ",", ";")) and 0 < len(text.split()) <= 14


def _or(pattern: re.Pattern[str]) -> Callable[[str], bool]:
    return lambda text: is_heading(text) or (_short(text) and bool(pattern.match(text)))


STRATEGIES: dict[str, Strategy] = {
    "regulation": Strategy(
        "Regulation",
        _or(_ROMAN_CHAPTER),
        900,
        None,
        "Excerpts carry the document's status. If an excerpt comes from a superseded document, say so and "
        "prefer the document that replaced it. Quote obligations ('shall', 'must') precisely and give "
        "effective dates where the text states them.",
    ),
    "contract": Strategy(
        "Contract",
        _or(_CONTRACT_SECTION),
        900,
        None,
        "Say which party each obligation binds. Keep conditions, exceptions, amounts and notice periods "
        "exactly as written. Do not interpret beyond the text.",
    ),
    "research_paper": Strategy(
        "Research paper",
        _or(_PAPER_SECTION),
        1100,
        _REFERENCES,
        "Separate what the authors found from what they speculate or cite from others. Report numbers with "
        "their units and the experiment or dataset they come from.",
    ),
    "financial_report": Strategy(
        "Financial report",
        is_heading,
        700,
        None,
        "Quote figures exactly with their currency, unit (for example crore or million) and period. Do not "
        "compute new figures unless asked, and show the arithmetic when you do.",
    ),
    "manual": Strategy(
        "Manual",
        _or(_STEP),
        800,
        None,
        "Give procedures as numbered steps in the document's order. Keep warnings and cautions.",
    ),
    "other": Strategy("Other", is_heading, 900, None, ""),
}


def strategy_for(doc_type: str | None) -> Strategy:
    return STRATEGIES.get(doc_type or "other", STRATEGIES["other"])


def clean_blocks(blocks: list[Block]) -> list[Block]:
    """Drop table-of-contents lines and boilerplate repeated on most pages (running headers, watermarks)."""
    pages = len({b.page for b in blocks})
    counts = Counter(b.text for b in {(b.page, b.text): b for b in blocks}.values())
    repeated = {t for t, n in counts.items() if pages >= 3 and n >= max(3, pages // 2) and len(t) <= 80}
    return [b for b in blocks if b.text not in repeated and not _TOC_LINE.search(b.text)]
