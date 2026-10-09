"""Prompt for answering questions over arbitrary uploaded documents."""

from src.docqa.doctypes.lineage import VersionStatus
from src.docqa.doctypes.strategies import strategy_for
from src.docqa.store import DocumentRecord

DOCUMENT_QA_PROMPT = """You answer questions about documents the user uploaded.

RULES:
1. Use ONLY the excerpts below. Do not use outside knowledge.
2. If the excerpts do not contain the answer, reply exactly: "I don't have sufficient evidence in the uploaded documents to answer this question."
3. Cite every factual statement with the document ID and page, like [DOC-1A2B3C4D, p. 7]. Copy the ID and page from the excerpt header. Never invent IDs or pages.
4. Keep the answer concise. Use bullet points for multi-part answers.
{type_rules}
EXCERPTS:
{context}

QUESTION:
{question}

ANSWER (with citations):"""


COMPARE_PROMPT = """You compare two documents the user uploaded: Document A and Document B.

RULES:
1. Use ONLY the excerpts below. Do not use outside knowledge.
2. If neither document's excerpts address the question, reply exactly: "I don't have sufficient evidence in the uploaded documents to answer this question."
3. Cite every statement with the document ID and page, like [DOC-1A2B3C4D, p. 7]. Copy them from the excerpt headers. Never invent IDs or pages.
4. Write these four sections as markdown headings, in this order: "## In both", "## Differences", "## Only in A", "## Only in B". Use bullet points in each.
5. Under "Differences", start each bullet with the topic, then what A says and what B says, each with its own citation.
6. If a section has nothing, write "- Nothing found in the excerpts." Never invent a difference.
{type_rules}
DOCUMENT A: {a_title} ({a_id})
DOCUMENT B: {b_title} ({b_id})

EXCERPTS:
{context}

QUESTION:
{question}

COMPARISON (with citations):"""

MULTI_RULE = (
    "Several documents are in scope. Address each relevant document separately and name it. "
    "If a document says nothing on the question, say so instead of guessing."
)


def type_rules(doc_types: list[str], extra: list[str] | None = None, start: int = 5) -> str:
    """Extra rules (mode rules, then one per document type present), numbered after the base rules."""
    rules = list(extra or [])
    for doc_type in dict.fromkeys(doc_types):
        strategy = strategy_for(doc_type)
        if strategy.rules:
            rules.append(f"For {strategy.label.lower()} excerpts: {strategy.rules}")
    return "".join(f"{i}. {rule}\n" for i, rule in enumerate(rules, start=start))


def format_context(
    hits,
    records: dict[str, DocumentRecord],
    statuses: dict[str, VersionStatus],
    labels: dict[str, str] | None = None,
) -> str:
    parts = []
    for hit in hits:
        c = hit.chunk
        record = records.get(c.doc_id)
        fields = [f"[{c.doc_id}, p. {c.page}]", f"Title: {record.title if record else c.doc_id}"]
        if labels and c.doc_id in labels:
            fields.insert(1, f"Document {labels[c.doc_id]}")
        if record:
            fields.append(f"Type: {strategy_for(record.doc_type).label}")
            if record.doc_date:
                fields.append(f"Date: {record.doc_date}")
        version = statuses.get(c.doc_id)
        if version and version.versioned:
            fields.append(f"Status: {version.status}")
            if version.superseded_by:
                fields.append(f"Superseded by: {version.superseded_by}")
        if c.section:
            fields.append(f"Section: {c.section}")
        parts.append(f"{' | '.join(fields)}\n{c.text}")
    return "\n\n---\n\n".join(parts)
