"""SSE event stream for questions over uploaded documents (same UI contract as /ask/stream)."""

import json
import re
import time
from collections.abc import Iterator

from langchain_core.prompts import ChatPromptTemplate

from src.docqa.doctypes.lineage import VersionStatus
from src.docqa.engine import Library
from src.docqa.planner import Plan, make_plan
from src.docqa.prompts import COMPARE_PROMPT, DOCUMENT_QA_PROMPT, MULTI_RULE, format_context, type_rules
from src.docqa.rewrite import rewrite_query
from src.docqa.store import DocumentRecord
from src.docqa.textutil import ReasoningTagFilter, is_refusal_answer, strip_reasoning_tags
from src.docqa.verify import check_citations
from src.llm.providers import failure_message

CITATION = re.compile(r"\[(DOC-[0-9A-F]{8}),\s*p\.?\s*(\d+)\]")


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


def _refusal() -> dict:
    return {
        "title": "I couldn’t find this in your documents.",
        "message": "Nothing in the selected documents answers this. Try rephrasing, or select more documents.",
        "suggestions": [
            "Summarise the main points of this document",
            "What obligations or deadlines does this document state?",
            "Which sections define the key terms?",
        ],
    }


def source_payload(hit, record: DocumentRecord, version: VersionStatus | None) -> dict:
    c = hit.chunk
    return {
        "circular_id": c.doc_id,
        "title": record.title,
        "clause_id": c.section,
        "page": c.page,
        "status": version.status if version else "active",
        "origin": "upload",
        "versioned": bool(version and version.versioned),
        "doc_type": record.doc_type,
        "superseded_by": version.superseded_by if version else None,
        "text": c.text,
        "date": record.doc_date or record.uploaded_at[:10],
    }


def resolve_citations(answer: str, hits) -> tuple[int, int]:
    """(resolved, total): citations whose doc and page match a retrieved chunk."""
    known = {(h.chunk.doc_id, h.chunk.page) for h in hits}
    found = [(m.group(1), int(m.group(2))) for m in CITATION.finditer(answer)]
    return sum(1 for f in found if f in known), len(found)


PER_DOC = {"compare": 4, "multi": 3}


def _messages(plan: Plan, hits, records: dict[str, DocumentRecord], statuses, question: str, history=None):
    from langchain_core.messages import AIMessage, HumanMessage
    history = history or []
    
    types = [records[h.chunk.doc_id].doc_type for h in hits if h.chunk.doc_id in records]
    if plan.mode == "compare":
        a, b = (records[d] for d in plan.doc_ids)
        labels = {a.id: "A", b.id: "B"}
        base = ChatPromptTemplate.from_template(COMPARE_PROMPT).format_messages(
            context=format_context(hits, records, statuses, labels),
            question=question,
            type_rules=type_rules(types, start=7),
            a_title=a.title,
            a_id=a.id,
            b_title=b.title,
            b_id=b.id,
        )
    else:
        extra = [MULTI_RULE] if plan.mode == "multi" else []
        base = ChatPromptTemplate.from_template(DOCUMENT_QA_PROMPT).format_messages(
            context=format_context(hits, records, statuses), question=question, type_rules=type_rules(types, extra)
        )
        
    if history:
        # In ChatPromptTemplate.from_template, it creates one HumanMessage if no roles are defined
        # We need to prepend the history before the question. Let's rebuild the sequence.
        # But wait, DOCUMENT_QA_PROMPT includes both the System instruction + Context + Question.
        # So we should prepend the history to the question.
        # Since it's a single message returned by base, we can't easily insert history between System and Question.
        # Actually, base is [HumanMessage(content=...)]
        # We will keep it simple and just prepend the previous Q&A directly into the prompt text,
        # or construct real Human/AIMessages before the final message.
        # Let's construct a list of messages.
        msgs = []
        for msg in history:
            msgs.append(HumanMessage(content=msg.question))
            msgs.append(AIMessage(content=msg.answer))
        # Now add the final prompt which includes context and current question
        return msgs + base
    return base


def plan_payload(plan: Plan, records: dict[str, DocumentRecord], hits, retrieval: dict) -> dict:
    labels = "AB" if plan.mode == "compare" else ""
    contributing = {h.chunk.doc_id for h in hits}
    return {
        "type": "plan",
        "mode": plan.mode,
        "reason": plan.reason,
        "documents": [
            {
                "id": doc_id,
                "title": records[doc_id].title,
                "label": labels[i] if labels else None,
                "passages": sum(1 for h in hits if h.chunk.doc_id == doc_id),
            }
            for i, doc_id in enumerate(plan.doc_ids)
            if doc_id in records
        ],
        "contributing": sorted(contributing),
        "retrieval": retrieval,
    }


def retrieve(
    library: Library,
    rewriter,
    question: str,
    doc_ids: set[str] | None,
    task: str = "ask",
    *,
    mode: str = "hybrid",
    rerank: bool = False,
    rewrite: bool = False,
) -> tuple[Plan, list, dict]:
    """Plan, optionally rewrite, and search: the retrieval half of answering, shared with the evaluation."""
    selected = [d for d in library.list_documents() if doc_ids is None or d.id in doc_ids]
    plan = make_plan(question, task, selected)
    rewritten = rewrite_query(rewriter, question) if rewrite and mode != "dense" else None
    options = {"mode": mode, "rerank": rerank, "rewritten": rewritten}
    if plan.mode == "single":
        hits = library.search(question, doc_ids, **options)
    else:
        hits = library.search_each(question, list(plan.doc_ids), PER_DOC[plan.mode], **options)
    return plan, hits, {"mode": mode, "rerank": rerank and library.can_rerank, "rewritten": rewritten}


def stream_library_events(
    library: Library,
    llm,
    question: str,
    doc_ids: set[str] | None,
    task: str = "ask",
    *,
    mode: str = "hybrid",
    rerank: bool = False,
    rewrite: bool = False,
    model: str | None = None,
    rewriter=None,
    history=None,
) -> Iterator[str]:
    """`rewriter` is a quick model for the optional query rewrite; the answer model is used if omitted."""
    start = time.perf_counter()
    yield _sse({"type": "stage", "name": "understanding"})
    records = {d.id: d for d in library.list_documents()}
    yield _sse({"type": "stage", "name": "searching"})
    plan, hits, retrieval = retrieve(library, rewriter or llm, question, doc_ids, task, mode=mode, rerank=rerank, rewrite=rewrite)
    yield _sse(plan_payload(plan, records, hits, retrieval))
    yield _sse({"type": "stage", "name": "reranking"})
    statuses = library.statuses()
    sources = [
        source_payload(h, records[h.chunk.doc_id], statuses.get(h.chunk.doc_id)) for h in hits if h.chunk.doc_id in records
    ]
    yield _sse({"type": "sources", "items": sources})
    yield _sse({"type": "stage", "name": "drafting"})

    def usage(used: int) -> dict:
        return {
            "latency_ms": int((time.perf_counter() - start) * 1000),
            "passages_checked": len(hits),
            "passages_used": used,
            **({"model": model} if model else {}),
        }

    if not hits:
        yield _sse({"type": "done", "refused": True, "usage": usage(0), "refusal": _refusal()})
        return

    visible = ReasoningTagFilter()
    chunks: list[str] = []
    try:
        for part in llm.stream(_messages(plan, hits, records, statuses, question, history=history)):
            if not part.text:
                continue
            chunks.append(part.text)
            text = visible.feed(part.text)
            if text:
                yield _sse({"type": "token", "text": text})
    except Exception as exc:  # provider down, out of credit, crashed runner: say so instead of dropping the stream
        yield _sse({"type": "error", "message": failure_message(exc)})
        return
    tail = visible.finish()
    if tail:
        yield _sse({"type": "token", "text": tail})

    answer = strip_reasoning_tags("".join(chunks))
    refused = is_refusal_answer(answer)
    resolved, total = resolve_citations(answer, hits)
    done = {"type": "done", "refused": refused, "usage": usage(0 if refused else len(hits))}
    done["usage"]["citations_resolved"] = resolved
    done["usage"]["citations_total"] = total
    if not refused:
        done["citations"] = [c.to_dict() for c in check_citations(answer, library.page_text)]
    if refused:
        done["refusal"] = _refusal()
    yield _sse(done)
