from fastapi.testclient import TestClient

from src.api import library as library_api
from src.api.main import app
from src.docqa.engine import Library
from src.docqa.verify import check_citations, content_words
from tests.test_docqa import HashEmbedder, make_pdf

PAGES = {
    ("DOC-AAAAAAAA", 3): "Rent is payable monthly on the first day of each month. Late payment attracts a fee of 2 percent.",
    ("DOC-AAAAAAAA", 5): "The security deposit is refundable within 30 days of vacating the premises.",
}


def lookup(doc_id: str, page: int) -> str:
    return PAGES.get((doc_id, page), "")


def statuses(answer: str) -> list[str]:
    return [c.status for c in check_citations(answer, lookup)]


def test_supported_partial_and_unsupported():
    answer = (
        "Rent is payable monthly on the first day [DOC-AAAAAAAA, p. 3]. "
        "Late payment attracts a fee of 5 percent and eviction notices [DOC-AAAAAAAA, p. 3]. "
        "Pets are forbidden in the building [DOC-AAAAAAAA, p. 3]."
    )
    assert statuses(answer) == ["supported", "partial", "unsupported"]


def test_wrong_page_is_caught():
    answer = "The security deposit is refundable within 30 days [DOC-AAAAAAAA, p. 3]."
    check = check_citations(answer, lookup)[0]
    assert check.status in {"partial", "unsupported"}
    assert check_citations(answer.replace("p. 3", "p. 5"), lookup)[0].status == "supported"


def test_missing_page_and_page_less_and_too_short():
    assert statuses("Something [DOC-AAAAAAAA, p. 99].") == ["not_found"]
    assert statuses("Rent is monthly [DOC-AAAAAAAA].") == ["unchecked"]
    assert statuses("Yes [DOC-AAAAAAAA, p. 3].") == ["unchecked"]


def test_claim_is_scoped_to_its_own_sentence_and_groups_split():
    answer = (
        "- Rent is payable monthly [DOC-AAAAAAAA, p. 3].\n"
        "- The deposit is refundable within 30 days [DOC-AAAAAAAA, p. 5; DOC-AAAAAAAA, p. 3]."
    )
    checks = check_citations(answer, lookup)
    assert [c.claim for c in checks][:2] == ["Rent is payable monthly", "The deposit is refundable within 30 days"]
    assert [c.status for c in checks] == ["supported", "supported", "unsupported"]
    assert checks[1].evidence and "refundable" in checks[1].evidence


def test_non_document_brackets_are_ignored():
    assert check_citations("See [note 1] and [RBI/2025-26/36, Clause 8].", lookup) == []


def test_content_words_keep_numbers():
    assert content_words("Within 30 days of the notice") == ["within", "30", "days", "notice"]


def test_page_text_and_original_file(tmp_path, monkeypatch):
    lib = Library(tmp_path, HashEmbedder(), 5_000_000, 50)
    data = make_pdf([["Cover page text."], ["Indemnity covers third party claims."]])
    record, _ = lib.add_pdf(data, "contract.pdf")
    assert "Indemnity" in lib.page_text(record.id, 2)
    assert lib.page_text(record.id, 7) == ""

    monkeypatch.setitem(app.dependency_overrides, library_api.get_library, lambda: lib)
    client = TestClient(app)
    res = client.get(f"/documents/{record.id}/file")
    assert res.status_code == 200 and res.headers["content-type"] == "application/pdf" and res.content == data
    assert client.get("/documents/DOC-00000000/file").status_code == 404

    assert lib.delete(record.id)
    assert lib.file_path(record.id) is None and not list((tmp_path / "files").iterdir())


def test_reupload_restores_original_for_documents_indexed_before_files_were_kept(tmp_path):
    lib = Library(tmp_path, HashEmbedder(), 5_000_000, 50)
    data = make_pdf([["Cover."], ["Termination needs ninety days written notice."]])
    record, _ = lib.add_pdf(data, "contract.pdf")
    # Simulate a Phase 12 upload: no stored original, no page text.
    (tmp_path / "files" / f"{record.id}.pdf").unlink()
    with lib._store._connect() as conn:
        conn.execute("DELETE FROM pages")
    assert lib.file_path(record.id) is None

    again, created = lib.add_pdf(data, "contract.pdf")
    assert not created and again.id == record.id
    assert lib.file_path(record.id) is not None
    assert "ninety days" in lib.page_text(record.id, 2)


def test_adjacent_citations_share_the_statement_before_them():
    answer = "The deposit is refundable within 30 days [DOC-AAAAAAAA, p. 5] [DOC-AAAAAAAA, p. 3]. Rent is monthly [DOC-AAAAAAAA, p. 3]."
    checks = check_citations(answer, lookup)
    assert [c.claim for c in checks] == ["The deposit is refundable within 30 days"] * 2 + ["Rent is monthly"]
    assert [c.status for c in checks] == ["supported", "unsupported", "supported"]
