"""Decide how to answer: one pooled search, a search per document, or a two-document comparison."""

import re
from dataclasses import dataclass

from src.docqa.store import DocumentRecord

COMPARE_WORDS = re.compile(
    r"\b(?:compare[ds]?|comparison|contrast|differ(?:s|ence|ences|ent)?|versus|vs\.?|what changed|changes? between)\b",
    re.IGNORECASE,
)
SPAN_WORDS = re.compile(r"\b(?:each|every|both|across|all (?:the |of the )?(?:documents|files|pdfs|uploads))\b", re.IGNORECASE)


class PlanError(ValueError):
    pass


@dataclass(frozen=True)
class Plan:
    mode: str  # single | multi | compare
    doc_ids: tuple[str, ...]  # compare: (A, B); multi: every document searched
    reason: str


def _chronological(docs: list[DocumentRecord]) -> list[DocumentRecord]:
    """Earlier document first, by stated date when both have one, else by upload time."""
    if all(d.doc_date for d in docs):
        return sorted(docs, key=lambda d: d.doc_date or "")
    return sorted(docs, key=lambda d: d.uploaded_at)


def make_plan(question: str, task: str, selected: list[DocumentRecord]) -> Plan:
    if task == "compare":
        if len(selected) != 2:
            raise PlanError("Compare needs exactly two documents.")
        a, b = _chronological(selected)
        return Plan("compare", (a.id, b.id), "You chose Compare. A is the earlier document.")
    if len(selected) == 2 and COMPARE_WORDS.search(question):
        a, b = _chronological(selected)
        return Plan("compare", (a.id, b.id), "The question asks for a comparison and two documents are selected.")
    if len(selected) >= 2 and (COMPARE_WORDS.search(question) or SPAN_WORDS.search(question)):
        return Plan(
            "multi", tuple(d.id for d in selected), "The question spans several documents, so each one is searched separately."
        )
    return Plan("single", tuple(d.id for d in selected), "")
