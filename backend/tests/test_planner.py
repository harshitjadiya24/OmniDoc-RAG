import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessageChunk

from src.api.main import app
from src.docqa.engine import Library
from src.docqa.planner import PlanError, make_plan
from src.docqa.stream import stream_library_events
from tests.test_docqa import HashEmbedder, make_pdf
from tests.test_doctypes import record

OLD = record("DOC-OLD", doc_date="2022-09-02")
NEW = record("DOC-NEW", doc_date="2025-05-08")
THIRD = record("DOC-3RD")


def test_explicit_compare_orders_the_earlier_document_first():
    plan = make_plan("cooling-off period", "compare", [NEW, OLD])
    assert (plan.mode, plan.doc_ids) == ("compare", ("DOC-OLD", "DOC-NEW"))


def test_compare_needs_exactly_two_documents():
    with pytest.raises(PlanError):
        make_plan("x", "compare", [OLD])


@pytest.mark.parametrize(
    ("question", "docs", "mode"),
    [
        ("What changed between these two?", [OLD, NEW], "compare"),
        ("How does the fee differ?", [OLD, NEW], "compare"),
        ("How does the fee differ?", [OLD, NEW, THIRD], "multi"),
        ("What does each document say about fees?", [OLD, NEW, THIRD], "multi"),
        ("What is the fee?", [OLD, NEW], "single"),
        ("Compare the fees", [OLD], "single"),
    ],
)
def test_planner_picks_a_mode_from_the_question_and_selection(question, docs, mode):
    assert make_plan(question, "ask", docs).mode == mode


@pytest.fixture
def lib(tmp_path):
    return Library(tmp_path, HashEmbedder(), 5_000_000, 50)


def test_search_each_gives_every_document_a_share(lib):
    loud, _ = lib.add_pdf(make_pdf([["Fees fees fees. The fee is charged monthly. Fee schedule and fee waivers."] * 3]), "a.pdf")
    quiet, _ = lib.add_pdf(make_pdf([["A small fee may apply to late payments."]]), "b.pdf")
    pooled = {h.chunk.doc_id for h in lib.search("fee", None, 2)}
    each = lib.search_each("fee", [loud.id, quiet.id], 2)
    assert quiet.id in {h.chunk.doc_id for h in each}
    assert each[0].chunk.doc_id == loud.id and each[1].chunk.doc_id == quiet.id
    assert pooled  # pooled search still works; it may or may not include the quiet document


class FakeLLM:
    def __init__(self, text: str):
        self.text = text
        self.prompt = ""

    def stream(self, messages):
        self.prompt = "\n".join(m.content for m in messages)
        for word in self.text.split(" "):
            yield AIMessageChunk(content=word + " ")


def events(gen) -> list[dict]:
    return [json.loads(line[6:]) for line in gen if line.startswith("data: ")]


def test_compare_stream_labels_documents_and_checks_citations(lib):
    old, _ = lib.add_pdf(make_pdf([["The cooling-off period is three days for all loans."]]), "old.pdf")
    new, _ = lib.add_pdf(make_pdf([["The cooling-off period is at least one day, set by the board."]]), "new.pdf")
    lib.update(old.id, {"doc_date": "2022-09-02"})
    lib.update(new.id, {"doc_date": "2025-05-08"})
    answer = (
        f"## Differences\n- Cooling-off period: A sets three days [{old.id}, p. 1]; B sets at least one day [{new.id}, p. 1].\n"
        "## Only in A\n- Nothing found in the excerpts."
    )
    llm = FakeLLM(answer)
    out = events(stream_library_events(lib, llm, "cooling-off period", {old.id, new.id}, "compare"))

    plan = next(e for e in out if e["type"] == "plan")
    assert plan["mode"] == "compare"
    assert [(d["id"], d["label"]) for d in plan["documents"]] == [(old.id, "A"), (new.id, "B")]
    assert set(plan["contributing"]) == {old.id, new.id}
    assert "DOCUMENT A: old" in llm.prompt and "## In both" in llm.prompt and f"[{old.id}, p. 1] | Document A" in llm.prompt
    sources = next(e for e in out if e["type"] == "sources")["items"]
    assert {s["circular_id"] for s in sources} == {old.id, new.id}
    done = out[-1]
    assert done["type"] == "done" and not done["refused"]
    assert [c["status"] for c in done["citations"]] == ["supported", "supported"]


def test_multi_mode_adds_the_per_document_rule(lib):
    a, _ = lib.add_pdf(make_pdf([["Rent is due monthly."]]), "a.pdf")
    b, _ = lib.add_pdf(make_pdf([["Deposit is refundable."]]), "b.pdf")
    c, _ = lib.add_pdf(make_pdf([["Pets are not allowed."]]), "c.pdf")
    llm = FakeLLM(f"Each document covers one topic [{a.id}, p. 1].")
    out = events(stream_library_events(lib, llm, "What does each document say?", {a.id, b.id, c.id}))
    assert next(e for e in out if e["type"] == "plan")["mode"] == "multi"
    assert "Address each relevant document separately" in llm.prompt


def test_compare_request_with_wrong_document_count_is_rejected():
    res = TestClient(app).post("/ask/stream", json={"question": "compare these", "document_ids": ["DOC-A"], "task": "compare"})
    assert res.status_code == 422
