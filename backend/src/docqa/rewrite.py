"""Optional query rewriting: ask the answer model for search keywords to add to the BM25 query."""

import re

from src.docqa.textutil import strip_reasoning_tags

REWRITE_PROMPT = (
    "Rewrite this question as a search query for formal documents: 4 to 12 keywords, including likely "
    "synonyms and the formal terms such documents use. Output only the keywords on one line, nothing else.\n\n"
    "Question: {question}\nKeywords:"
)
_KEEP = re.compile(r"[^\w\s\-/().]")


def rewrite_query(llm, question: str) -> str | None:
    """Keywords for the sparse leg, or None if the model returns nothing usable. Never replaces the question."""
    try:
        reply = llm.invoke(REWRITE_PROMPT.format(question=question))
    except Exception:
        return None
    content = reply.text
    lines = [line for line in strip_reasoning_tags(content).splitlines() if line.strip()]
    keywords = " ".join(_KEEP.sub(" ", lines[0]).split()) if lines else ""
    return keywords[:200] or None
