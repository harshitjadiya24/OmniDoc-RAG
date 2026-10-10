import json
import shutil

import pymupdf
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessageChunk

from src.api import llm as llm_api
from src.api.main import app
from src.config import Settings
from src.docqa.chunking import table_pieces
from src.docqa.engine import Library
from src.docqa.extract import PdfError, extract_pdf, is_real_table, table_rows
from src.docqa.rewrite import rewrite_query
from src.docqa.stream import stream_library_events
from src.llm import providers
from tests.test_docqa import HashEmbedder, make_pdf


def ruled_table_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 60), "Schedule of fees", fontsize=12)
    rows = [["Service", "Fee", "Period"], ["Late payment", "2 percent", "monthly"], ["Cheque bounce", "500 rupees", "per event"]]
    x0, y0, w, h = 72, 80, 150, 24
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            rect = pymupdf.Rect(x0 + c * w, y0 + r * h, x0 + (c + 1) * w, y0 + (r + 1) * h)
            page.draw_rect(rect, color=(0, 0, 0), width=0.8)
            page.insert_text((rect.x0 + 4, rect.y0 + 16), cell, fontsize=10)
    data = doc.tobytes()
    doc.close()
    return data


def scanned_pdf() -> bytes:
    src = pymupdf.open(
        stream=make_pdf([["The indemnity clause covers third party claims arising from negligence."]]), filetype="pdf"
    )
    pix = src[0].get_pixmap(dpi=200)
    out = pymupdf.open()
    page = out.new_page(width=src[0].rect.width, height=src[0].rect.height)
    page.insert_image(page.rect, pixmap=pix)
    return out.tobytes()


def test_table_cleaning_drops_padding_and_rejects_boxed_paragraphs():
    assert table_rows([["A", None, "B"], [None, None, None], ["1", None, "2"]]) == [["A", "B"], ["1", "2"]]
    assert not is_real_table(table_rows([["Boxed paragraph line one", None], ["line two", None]]))
    assert is_real_table([["Service", "Fee"], ["Late", "2%"]])


def test_ruled_tables_become_row_blocks_without_duplicate_text():
    extracted = extract_pdf(ruled_table_pdf(), 10)
    tables = [b for b in extracted.blocks if b.kind == "table"]
    assert len(tables) == 1
    assert tables[0].text.splitlines()[1] == "| Late payment | 2 percent | monthly |"
    assert not any(b.kind == "text" and "Cheque bounce" in b.text for b in extracted.blocks)


def test_large_tables_split_by_rows_with_the_header_repeated():
    text = "| Service | Fee |\n" + "\n".join(f"| item {i} | {i} rupees |" for i in range(40))
    pieces = table_pieces(text, 200)
    assert len(pieces) > 3 and all(p.startswith("| Service | Fee |") for p in pieces)
    assert sum(len(p.splitlines()) - 1 for p in pieces) == 40


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract is not installed")
def test_scanned_pages_are_ocred_within_the_budget():
    data = scanned_pdf()
    with pytest.raises(PdfError, match="turned off"):
        extract_pdf(data, 10, ocr_max_pages=0)
    extracted = extract_pdf(data, 10, ocr_max_pages=1)
    assert extracted.ocr_pages == 1
    assert "indemnity" in " ".join(b.text for b in extracted.blocks).lower()


class ReverseReranker:
    def score(self, query, texts):
        return [float(-i) for i in range(len(texts))][::-1]  # last candidate scores highest


@pytest.fixture
def lib(tmp_path):
    lib = Library(tmp_path, HashEmbedder(), 5_000_000, 50, reranker=ReverseReranker())
    lib.add_pdf(make_pdf([["Cooling off period lets the borrower exit the loan."]]), "a.pdf")
    lib.add_pdf(make_pdf([["Grievance redressal officer must respond within 30 days."]]), "b.pdf")
    return lib


def test_modes_use_the_requested_retrievers(lib):
    assert lib.search("borrower exit", mode="bm25", limit=1)[0].chunk.text.startswith("Cooling")
    assert lib.search("zzz unrelated", mode="bm25") == []
    assert len(lib.search("zzz unrelated", mode="dense", limit=2)) == 2  # dense always returns nearest neighbours


def test_rewritten_keywords_reach_the_sparse_leg(lib):
    assert lib.search("how fast", mode="bm25") == []
    assert lib.search("how fast", mode="bm25", rewritten="grievance respond days")[0].chunk.text.startswith("Grievance")


def test_rerank_reorders_the_candidate_pool(lib):
    plain = [h.chunk.text for h in lib.search("borrower loan exit", limit=2)]
    reranked = [h.chunk.text for h in lib.search("borrower loan exit", limit=2, rerank=True)]
    assert reranked == plain[::-1]


class KeywordLLM:
    def __init__(self, reply):
        self.reply = reply

    def invoke(self, prompt):
        if isinstance(self.reply, Exception):
            raise self.reply
        return AIMessageChunk(content=self.reply)

    def stream(self, messages):
        yield AIMessageChunk(content="Answer [DOC-00000000, p. 1].")


def test_rewrite_strips_reasoning_and_falls_back_to_none():
    assert (
        rewrite_query(KeywordLLM("<think>hmm</think>\ncooling-off period; minimum days!"), "q")
        == "cooling-off period minimum days"
    )
    assert rewrite_query(KeywordLLM(RuntimeError("down")), "q") is None
    assert rewrite_query(KeywordLLM("   "), "q") is None


def test_plan_event_reports_the_retrieval_actually_used(lib):
    out = [
        json.loads(line[6:])
        for line in stream_library_events(
            lib,
            KeywordLLM("grievance officer"),
            "how fast must they respond",
            None,
            mode="hybrid",
            rerank=True,
            rewrite=True,
            model="ollama:test",
        )
        if line.startswith("data: ")
    ]
    plan = next(e for e in out if e["type"] == "plan")
    assert plan["retrieval"] == {"mode": "hybrid", "rerank": True, "rewritten": "grievance officer"}
    assert out[-1]["usage"]["model"] == "ollama:test"


def test_providers_need_keys_and_report_why(monkeypatch):
    s = Settings(LLM_PROVIDER="ollama", GEMINI_API_KEY="", GROQ_API_KEY="", MISTRAL_API_KEY="", OPENROUTER_API_KEY="")
    with pytest.raises(providers.ProviderUnavailable, match="GEMINI_API_KEY"):
        providers.chat_model("gemini", s)
    with pytest.raises(providers.ProviderUnavailable, match="GROQ_API_KEY"):
        providers.chat_model("groq", s)
    with pytest.raises(providers.ProviderUnavailable, match="MISTRAL_API_KEY"):
        providers.chat_model("mistral", s)
    with pytest.raises(providers.ProviderUnavailable, match="OPENROUTER_API_KEY"):
        providers.chat_model("openrouter", s)
    with pytest.raises(providers.ProviderUnavailable, match="Unknown provider"):
        providers.chat_model("other", s)
    assert type(providers.chat_model("gemini", Settings(GEMINI_API_KEY="g-test"))).__name__ == "ChatGoogleGenerativeAI"
    assert type(providers.chat_model("groq", Settings(GROQ_API_KEY="gsk-test"))).__name__ == "ChatGroq"
    assert type(providers.chat_model("mistral", Settings(MISTRAL_API_KEY="m-test"))).__name__ == "ChatMistralAI"
    openrouter = providers.chat_model("openrouter", Settings(OPENROUTER_API_KEY="sk-or-test"))
    assert type(openrouter).__name__ == "ChatOpenAI" and openrouter.openai_api_base == providers.OPENROUTER_URL
    routed = Settings(OPENROUTER_MODEL="a:free", OPENROUTER_FALLBACK_MODELS=" b:free, a:free ,c:free,d:free")
    assert providers.openrouter_models(routed) == ["a:free", "b:free", "c:free"]

    monkeypatch.setattr(providers, "_ollama_has", lambda settings: (False, "Ollama is not reachable."))
    monkeypatch.setattr(llm_api, "settings", s)
    body = TestClient(app).get("/llm/providers").json()
    assert body["default"] == "ollama"
    assert [(p["id"], p["available"]) for p in body["providers"]] == [
        ("ollama", False),
        ("openrouter", False),
        ("mistral", False),
        ("groq", False),
        ("gemini", False),
    ]


def test_ask_with_an_unconfigured_provider_is_rejected_before_streaming(monkeypatch):
    from src.config import settings

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    res = TestClient(app).post("/ask/stream", json={"question": "what is the fee", "document_ids": [], "provider": "gemini"})
    assert res.status_code == 422 and "GEMINI_API_KEY" in res.json()["detail"]


def test_keyword_search_works_in_a_one_document_library(tmp_path):
    lib = Library(tmp_path, HashEmbedder(), 5_000_000, 50)
    lib.add_pdf(make_pdf([["The tenant pays rent monthly."]]), "lease.pdf")
    assert lib.search("rent", mode="bm25")[0].chunk.text.startswith("The tenant")


def test_every_provider_has_an_output_cap_and_quick_mode_turns_reasoning_off():
    s = Settings(
        GEMINI_API_KEY="g-test",
        GROQ_API_KEY="gsk-test",
        MISTRAL_API_KEY="m-test",
        OPENROUTER_API_KEY="sk-or-test",
        LLM_MAX_TOKENS=900,
    )
    ollama = providers.chat_model("ollama", s)
    quick = providers.chat_model("ollama", s, quick=True)
    assert ollama.num_predict == 900 and quick.num_predict == providers.QUICK_TOKENS and quick.reasoning is False
    assert providers.chat_model("gemini", s).max_output_tokens == 900
    assert providers.chat_model("groq", s).max_tokens == 900
    assert providers.chat_model("mistral", s).max_tokens == 900
    assert providers.chat_model("openrouter", s).max_tokens == 900
    assert providers.chat_model("gemini", s, quick=True).max_output_tokens == providers.QUICK_TOKENS


def test_stream_uses_the_quick_rewriter_when_given(lib):
    answer_model = KeywordLLM(RuntimeError("the answer model must not be used for rewriting"))
    answer_model.stream = lambda messages: iter([AIMessageChunk(content="ok")])
    out = [
        json.loads(line[6:])
        for line in stream_library_events(
            lib,
            answer_model,
            "how fast must they respond",
            None,
            rewrite=True,
            rewriter=KeywordLLM("grievance officer"),
        )
        if line.startswith("data: ")
    ]
    assert next(e for e in out if e["type"] == "plan")["retrieval"]["rewritten"] == "grievance officer"


def test_streams_with_thinking_blocks_yield_only_the_answer_text(lib):
    class ClaudeLike:
        def stream(self, messages):
            yield AIMessageChunk(content=[{"type": "thinking", "thinking": "", "index": 0}])
            yield AIMessageChunk(content=[{"type": "text", "text": "Answer ", "index": 1}])
            yield AIMessageChunk(content=[{"type": "text", "text": "text.", "index": 1}])

    out = [
        json.loads(line[6:])
        for line in stream_library_events(lib, ClaudeLike(), "borrower exit", None)
        if line.startswith("data: ")
    ]
    assert "".join(e["text"] for e in out if e["type"] == "token") == "Answer text."


def test_a_failing_answer_model_ends_the_stream_with_an_error_event(lib):
    class OutOfCredit(Exception):
        body = {"type": "error", "error": {"type": "invalid_request_error", "message": "Your credit balance is too low."}}

    class Broken:
        def stream(self, messages):
            yield AIMessageChunk(content="Partial ")
            raise OutOfCredit("400")

    out = [
        json.loads(line[6:]) for line in stream_library_events(lib, Broken(), "borrower exit", None) if line.startswith("data: ")
    ]
    assert out[-1] == {"type": "error", "message": "The answer model could not respond: Your credit balance is too low."}
    assert not any(e["type"] == "done" for e in out)
