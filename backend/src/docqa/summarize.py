"""Generate a short summary and a few example questions for an uploaded document,
in one LLM pass over the start of its text. Best-effort: failures return empty results."""

import json
import re

from src.docqa.textutil import strip_reasoning_tags
MAX_CHARS = 30000  # Give enough context to generate a 1-2 page summary

_SUMMARY_PROMPT = """You are summarising a document for a reader who has not seen it.

Document title: {title}

Document text (may be truncated):
---
{text}
---

Write a very detailed and comprehensive summary that is at least 1-2 pages long (around 500-1000 words). Use paragraphs and bullet points for readability. Describe the document's purpose, scope, key provisions, and all important details in plain language. 
Do NOT output JSON. Write the summary directly in Markdown."""

_QUESTIONS_PROMPT = """Document title: {title}

Document text (may be truncated):
---
{text}
---

Write a JSON array containing exactly 4 short, specific questions a reader could ask that THIS document answers. No numbering.
Example format: ["Question 1?", "Question 2?", "Question 3?", "Question 4?"]
Return ONLY the JSON array, nothing else."""


def _extract_json_list(text: str) -> list[str]:
    text = strip_reasoning_tags(text).strip()
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def summarize_document(llm, title: str, text: str) -> tuple[str | None, list[str]]:
    """Returns (summary, example_questions). Either may be empty if the model fails or is unavailable."""
    snippet = text[:MAX_CHARS].strip()
    if not snippet:
        return None, []
    
    summary = None
    questions = []
    
    try:
        reply_summary = llm.invoke(_SUMMARY_PROMPT.format(title=title or "Untitled", text=snippet))
        summary = strip_reasoning_tags(reply_summary.text if hasattr(reply_summary, "text") else str(reply_summary)).strip()
        
        reply_questions = llm.invoke(_QUESTIONS_PROMPT.format(title=title or "Untitled", text=snippet[:6000]))
        raw_questions = _extract_json_list(reply_questions.text if hasattr(reply_questions, "text") else str(reply_questions))
        questions = [" ".join(str(q).split()) for q in raw_questions if str(q).strip()][:6]
    except Exception:
        pass
        
    return summary or None, questions
