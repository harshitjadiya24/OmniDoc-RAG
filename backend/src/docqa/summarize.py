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

Write a very detailed and comprehensive summary that is at least 1-2 pages long (around 500-1000 words).
Use paragraphs and bullet points for readability. Describe the document's purpose, scope, key provisions,
and all important details in plain language.
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


def _was_cut_off(reply) -> bool:
    """True when the model stopped at its output cap (Groq/Gemini finish_reason, Ollama done_reason)."""
    meta = getattr(reply, "response_metadata", None) or {}
    return str(meta.get("finish_reason") or meta.get("done_reason") or "").lower() in {"length", "max_tokens"}


def _trim_to_last_paragraph(text: str) -> str:
    """Drop a trailing half-written paragraph, or failing that a half-written sentence, plus any heading
    or lead-in line ("...as follows:") left with nothing under it."""
    cut = text.rfind("\n\n")
    if cut > len(text) * 0.4:
        lines = text[:cut].rstrip().split("\n")
        while len(lines) > 1 and (lines[-1].rstrip().endswith(":") or lines[-1].lstrip().startswith("#")):
            lines.pop()
        return "\n".join(lines).rstrip()
    end = max(text.rfind(". "), text.rfind(".\n"))
    return text[: end + 1] if end > 0 else text


def summarize_document(llm, title: str, text: str) -> tuple[str | None, list[str]]:
    """Returns (summary, example_questions). Either may be empty if the model fails or is unavailable.

    Questions are asked first: they are short, so on a rate-limited provider the long summary only waits
    briefly for output budget, and a failed summary never takes the questions with it."""
    snippet = text[:MAX_CHARS].strip()
    if not snippet:
        return None, []
    title = title or "Untitled"

    questions: list[str] = []
    try:
        reply = llm.invoke(_QUESTIONS_PROMPT.format(title=title, text=snippet[:6000]))
        questions = [" ".join(str(q).split()) for q in _extract_json_list(reply.text) if str(q).strip()][:6]
    except Exception:
        pass

    summary = None
    try:
        reply = llm.invoke(_SUMMARY_PROMPT.format(title=title, text=snippet))
        summary = strip_reasoning_tags(reply.text).strip()
        if summary and _was_cut_off(reply):
            summary = _trim_to_last_paragraph(summary)
    except Exception:
        pass

    return summary or None, questions
