"""Citation support check: does the cited page contain the words of the statement that cites it?

A lexical heuristic, not proof. It catches citations to the wrong page and statements
the page does not mention; it cannot judge paraphrase, negation or reasoning.
"""

import re
from collections.abc import Callable
from dataclasses import asdict, dataclass

GROUP = re.compile(r"\[([^\[\]\n]{1,240})\]")
REF = re.compile(r"^\s*(DOC-[0-9A-F]{8})(?:\s*,\s*p(?:age)?\.?\s*(\d+))?\s*$")
_WORD = re.compile(r"[a-z0-9]+(?:[.'][a-z0-9]+)*")
_BOUNDARY = re.compile(r"(?:[.!?](?=\s)|\n)")
_SENTENCE = re.compile(r"(?<=[.!?;:])\s+|\n+")
_STOP = frozenset(
    [
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "by",
        "can",
        "could",
        "did",
        "do",
        "does",
        "for",
        "from",
        "had",
        "has",
        "have",
        "if",
        "in",
        "into",
        "is",
        "it",
        "its",
        "may",
        "might",
        "must",
        "not",
        "of",
        "on",
        "or",
        "shall",
        "should",
        "so",
        "such",
        "than",
        "that",
        "the",
        "their",
        "them",
        "then",
        "there",
        "these",
        "this",
        "those",
        "to",
        "under",
        "upon",
        "was",
        "were",
        "what",
        "when",
        "where",
        "which",
        "while",
        "who",
        "will",
        "with",
        "would",
        "you",
        "your",
        "also",
        "any",
        "per",
        "all",
        "each",
        "other",
        "only",
        "same",
        "both",
        "either",
    ]
)

SUPPORTED = 0.7
PARTIAL = 0.4
MIN_WORDS = 2


@dataclass(frozen=True)
class CitationCheck:
    doc_id: str
    page: int | None
    status: str  # supported | partial | unsupported | not_found | unchecked
    coverage: float | None
    claim: str
    evidence: str | None

    def to_dict(self) -> dict:
        return asdict(self)


def content_words(text: str) -> list[str]:
    return [w for w in _WORD.findall(text.lower()) if w not in _STOP and (len(w) > 2 or w.isdigit())]


def _claim_before(answer: str, start: int, floor: int) -> str:
    """The statement a citation closes: back to the previous citation or sentence boundary."""
    window = answer[floor:start]
    cut = 0
    for match in _BOUNDARY.finditer(window.rstrip()):
        cut = match.end()
    claim = re.sub(r"[*_#>`]|^\s*[-•]\s*|^\s*\d+[.)]\s+", " ", window[cut:], flags=re.MULTILINE)
    return " ".join(claim.split())


def _best_sentence(claim_words: set[str], page: str) -> str | None:
    best, best_score = None, 0
    for sentence in _SENTENCE.split(page):
        score = len(claim_words & set(content_words(sentence)))
        if score > best_score:
            best, best_score = " ".join(sentence.split()), score
    return best[:400] if best else None


def check_citations(answer: str, page_text: Callable[[str, int], str]) -> list[CitationCheck]:
    """One check per document citation, in the order they appear in the answer."""
    checks: list[CitationCheck] = []
    floor = 0
    claim = ""
    for group in GROUP.finditer(answer):
        refs = [REF.match(part) for part in group.group(1).split(";")]
        refs = [r for r in refs if r]
        if not refs:
            continue
        # Citations placed side by side ("… [A, p. 2] [B, p. 3].") share the statement before them.
        adjacent = floor > 0 and not answer[floor : group.start()].strip(" \t,;")
        claim = claim if adjacent else _claim_before(answer, group.start(), floor)
        floor = group.end()
        words = set(content_words(claim))
        for ref in refs:
            doc_id, page = ref.group(1), int(ref.group(2)) if ref.group(2) else None
            if page is None:
                checks.append(CitationCheck(doc_id, None, "unchecked", None, claim, None))
                continue
            text = page_text(doc_id, page)
            if not text:
                checks.append(CitationCheck(doc_id, page, "not_found", None, claim, None))
                continue
            if len(words) < MIN_WORDS:
                checks.append(CitationCheck(doc_id, page, "unchecked", None, claim, None))
                continue
            found = words & set(content_words(text))
            coverage = round(len(found) / len(words), 2)
            status = "supported" if coverage >= SUPPORTED else "partial" if coverage >= PARTIAL else "unsupported"
            checks.append(CitationCheck(doc_id, page, status, coverage, claim, _best_sentence(words, text)))
    return checks
