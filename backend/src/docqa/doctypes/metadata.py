"""Best-effort metadata from the first pages. Every value is labelled 'detected' in the UI and is editable."""

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from src.docqa.extract import Block

_MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ],
        1,
    )
}
_MON = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
_DATE_PATTERNS = [
    re.compile(rf"\b(?P<m>{_MON})\.?\s+(?P<d>\d{{1,2}}),?\s+(?P<y>(?:19|20)\d\d)\b", re.IGNORECASE),
    re.compile(rf"\b(?P<d>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<m>{_MON})\.?,?\s+(?P<y>(?:19|20)\d\d)\b", re.IGNORECASE),
    re.compile(r"\b(?P<y>(?:19|20)\d\d)-(?P<mn>\d{2})-(?P<d>\d{2})\b"),
]
_REFERENCE = re.compile(
    r"\b(?:[A-Z]{2,6}(?:/[A-Z]{2,8})*/\d{4}-\d{2}/\d+|SEBI/[A-Z0-9/_.-]{6,}|"
    r"(?:Circular|Notification|Order|Ref(?:erence)?)\s+No\.?\s*:?\s*[\w./()-]{3,})",
)
_ISSUERS = {
    "Reserve Bank of India": r"reserve bank of india|\brbi\.org\.in\b",
    "Securities and Exchange Board of India": r"securities and exchange board of india|\bsebi\.gov\.in\b",
    "Insurance Regulatory and Development Authority of India": r"insurance regulatory and development authority",
    "U.S. Securities and Exchange Commission": r"securities and exchange commission",
    "Financial Conduct Authority": r"financial conduct authority",
    "European Commission": r"european commission",
}
_COMPANY = re.compile(r"\b([A-Z][A-Za-z&.,' -]{1,60}?\s(?:Limited|Ltd\.?|Inc\.?|Corporation|Corp\.|PLC|LLC|LLP))\b")
_NOT_TITLE = re.compile(
    r"^(?:index|contents|table of contents|madam|dear|sir|to,?$|page \d)|repealed|withdrawn|superseded|www\.|@",
    re.IGNORECASE,
)
_PARENTHETICAL = re.compile(r"\((?:updated|amended|revised|as amended)[^)]*\)", re.IGNORECASE)
_JUNK_META = re.compile(r"microsoft word|untitled|\.docx?$|\.pdf$|^document\d*$", re.IGNORECASE)
_TITLE_WORDS = re.compile(
    r"\b(?:directions?|guidelines|regulations?|circular|agreement|contract|report|manual|guide|policy|act|"
    r"rules|code|framework|study|analysis|statement|terms)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Metadata:
    title: str
    doc_date: str | None
    issuer: str | None
    reference: str | None


def _iso(match: re.Match[str]) -> str | None:
    parts = match.groupdict()
    month = (
        int(parts["mn"])
        if parts.get("mn")
        else next((n for name, n in _MONTHS.items() if name.startswith(parts["m"].lower()[:3])), 0)
    )
    try:
        return date(int(parts["y"]), month, int(parts["d"])).isoformat()
    except ValueError:
        return None


def find_date(text: str) -> str | None:
    found = [(m.start(), _iso(m)) for p in _DATE_PATTERNS for m in p.finditer(text)]
    found = [f for f in found if f[1]]
    return min(found)[1] if found else None


def _opening(blocks: list[Block], pages: int = 2) -> list[str]:
    return [_PARENTHETICAL.sub("", b.text).strip() for b in blocks if b.page <= pages]


def _title(lines: list[str], meta_title: str | None, filename: str) -> str:
    if meta_title and len(meta_title) > 3 and not _JUNK_META.search(meta_title):
        return meta_title[:200]
    candidates: list[tuple[int, str]] = []
    for i, line in enumerate(lines[:15]):
        text = line
        if text.count("(") > text.count(")") and i + 1 < len(lines):
            text = f"{text} {lines[i + 1]}"
        words = len(text.split())
        if not 3 <= words <= 25 or _NOT_TITLE.search(text) or _REFERENCE.search(text) or find_date(text):
            continue
        if text.endswith(".") or any(re.fullmatch(p, text, re.IGNORECASE) for p in _ISSUERS.values()):
            continue
        candidates.append((2 if _TITLE_WORDS.search(text) else 0, text))
    if candidates:
        best = max(candidates, key=lambda c: c[0])
        return " ".join(best[1].split())[:200]
    stem = re.sub(r"[_\-]+", " ", Path(filename).stem).strip()
    return (stem or "Untitled document")[:200]


def extract_metadata(blocks: list[Block], doc_type: str, meta_title: str | None, filename: str) -> Metadata:
    lines = _opening(blocks)
    usable = [line for line in lines if not re.search(r"repealed|withdrawn|superseded", line, re.IGNORECASE)]
    text = "\n".join(usable)
    issuer = next((name for name, pat in _ISSUERS.items() if re.search(pat, text, re.IGNORECASE)), None)
    if issuer is None and doc_type in {"financial_report", "contract"}:
        company = _COMPANY.search(text)
        issuer = company.group(1).strip() if company else None
    reference = _REFERENCE.search(text) if doc_type == "regulation" else None
    return Metadata(
        title=_title(usable, meta_title, filename),
        doc_date=find_date(text),
        issuer=issuer,
        reference=reference.group(0).strip() if reference else None,
    )
