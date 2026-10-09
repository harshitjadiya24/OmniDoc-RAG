"""Version lineage across uploaded documents, from each document's declared `supersedes` list."""

from collections.abc import Iterable
from dataclasses import dataclass

from src.docqa.store import DocumentRecord


@dataclass(frozen=True)
class VersionStatus:
    status: str  # active | superseded
    superseded_by: str | None
    versioned: bool  # part of at least one supersedes edge


def derive_statuses(records: Iterable[DocumentRecord]) -> dict[str, VersionStatus]:
    """A `supersedes` entry may name another upload by document ID or by its reference number."""
    docs = list(records)
    lookup: dict[str, str] = {}
    for d in docs:
        lookup[d.id.lower()] = d.id
        if d.reference:
            lookup[d.reference.strip().lower()] = d.id
    replaced_by: dict[str, str] = {}
    linked: set[str] = set()
    # Oldest first, so when several documents claim the same target the newest one wins.
    for d in sorted(docs, key=lambda r: r.doc_date or r.uploaded_at):
        for entry in d.supersedes:
            target = lookup.get(entry.strip().lower())
            if target and target != d.id:
                replaced_by[target] = d.id
                linked.update({target, d.id})
    return {
        d.id: VersionStatus("superseded" if d.id in replaced_by else "active", replaced_by.get(d.id), d.id in linked)
        for d in docs
    }
