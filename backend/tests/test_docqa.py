import hashlib
from types import SimpleNamespace

import pymupdf
import pytest

from src.docqa.chunking import chunk_blocks, is_heading
from src.docqa.engine import Library, UploadTooLarge
from src.docqa.extract import Block, PdfError
from src.docqa.retrieval import reciprocal_rank_fusion, tokenize
from src.docqa.stream import resolve_citations


class HashEmbedder:
    DIM = 64

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * self.DIM
        for tok in tokenize(text):
            v[int(hashlib.md5(tok.encode()).hexdigest(), 16) % self.DIM] += 1.0
        norm = sum(x * x for x in v) ** 0.5 or 1.0
        return [x / norm for x in v]

    def embed_documents(self, texts):
        return [self._vec(t) for t in texts]

    def embed_query(self, text):
        return self._vec(text)


def make_pdf(pages: list[list[str]]) -> bytes:
    doc = pymupdf.open()
    for lines in pages:
        page = doc.new_page()
        y = 72
        for line in lines:
            page.insert_textbox(pymupdf.Rect(72, y, 520, y + 70), line, fontsize=11)
            y += 80
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture
def library(tmp_path):
    return Library(tmp_path, HashEmbedder(), max_bytes=5_000_000, max_pages=50)


def test_heading_detection():
    assert is_heading("3.2 Payment terms")
    assert is_heading("TERMINATION")
    assert not is_heading("The tenant shall pay rent monthly.")


def test_chunks_keep_page_and_section():
    blocks = [
        Block(1, "1. Definitions"),
        Block(1, "A tenant is a person who rents. " * 5),
        Block(2, "2. Payment"),
        Block(2, "Rent is due on the first day of every month."),
    ]
    chunks = chunk_blocks(blocks, target=300, overlap=0)
    assert chunks[0].section == "1. Definitions" and chunks[0].page == 1
    assert chunks[-1].section == "2. Payment" and chunks[-1].page == 2


def test_oversized_block_is_split():
    chunks = chunk_blocks([Block(1, "word " * 1000)], target=500, overlap=0)
    assert len(chunks) > 5 and all(len(c.text) <= 500 for c in chunks)


def test_rrf_prefers_items_ranked_by_both():
    fused = reciprocal_rank_fusion([["a", "b", "c"], ["c", "a", "d"]])
    assert [k for k, _ in fused][:2] == ["a", "c"]


def test_upload_search_scope_and_delete(library):
    lease = make_pdf([["1. Rent", "Monthly rent is payable on the first day of each month."]])
    bio = make_pdf([["Photosynthesis", "Chlorophyll absorbs light to convert carbon dioxide into glucose."]])
    a, created = library.add_pdf(lease, "lease_agreement.pdf")
    b, _ = library.add_pdf(bio, "biology notes.pdf")
    assert created and a.title == "lease agreement" and a.page_count == 1

    hits = library.search("when is rent payable")
    assert hits[0].chunk.doc_id == a.id and hits[0].chunk.page == 1
    scoped = library.search("chlorophyll glucose", {b.id})
    assert {h.chunk.doc_id for h in scoped} == {b.id}
    assert library.search("rent", {b.id}) == [] or all(h.chunk.doc_id == b.id for h in library.search("rent", {b.id}))

    assert library.delete(a.id) and not library.delete(a.id)
    assert all(h.chunk.doc_id != a.id for h in library.search("rent payable"))


def test_duplicate_upload_is_idempotent(library):
    data = make_pdf([["Some body text about contracts and obligations."]])
    first, created1 = library.add_pdf(data, "a.pdf")
    second, created2 = library.add_pdf(data, "renamed.pdf")
    assert created1 and not created2 and first.id == second.id
    assert len(library.list_documents()) == 1


def test_rejects_bad_uploads(library, tmp_path):
    with pytest.raises(PdfError):
        library.add_pdf(b"not a pdf", "x.pdf")
    blank = pymupdf.open()
    blank.new_page()
    with pytest.raises(PdfError, match="No selectable text"):
        library.add_pdf(blank.tobytes(), "scan.pdf")
    tiny = Library(tmp_path / "t", HashEmbedder(), max_bytes=10, max_pages=5)
    with pytest.raises(UploadTooLarge):
        tiny.add_pdf(b"%PDF" + b"0" * 100, "big.pdf")


def test_library_survives_restart(tmp_path):
    first = Library(tmp_path, HashEmbedder(), 5_000_000, 50)
    record, _ = first.add_pdf(make_pdf([["Indemnity clause covers third party claims."]]), "c.pdf")
    second = Library(tmp_path, HashEmbedder(), 5_000_000, 50)
    assert second.search("indemnity third party")[0].chunk.doc_id == record.id


def test_citation_resolution():
    hits = [SimpleNamespace(chunk=SimpleNamespace(doc_id="DOC-AAAAAAAA", page=3))]
    answer = "Yes [DOC-AAAAAAAA, p. 3]. Also [DOC-AAAAAAAA, p. 9] and [DOC-BBBBBBBB, p. 1]."
    assert resolve_citations(answer, hits) == (1, 3)
