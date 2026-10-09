from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from src.api import library as library_api
from src.api.main import app
from src.docqa.chunking import chunk_blocks
from src.docqa.doctypes.classify import classify
from src.docqa.doctypes.lineage import derive_statuses
from src.docqa.doctypes.metadata import extract_metadata, find_date
from src.docqa.doctypes.strategies import clean_blocks, strategy_for
from src.docqa.engine import Library, ReindexUnavailable
from src.docqa.extract import Block
from src.docqa.prompts import format_context, type_rules
from src.docqa.store import DocumentRecord
from tests.test_docqa import HashEmbedder, make_pdf


def blocks(*lines: str, page: int = 1) -> list[Block]:
    return [Block(page, line) for line in lines]


@pytest.mark.parametrize(
    ("lines", "expected"),
    [
        (
            [
                "This Agreement is made by and between Acme Ltd and the Tenant.",
                "WHEREAS the Landlord owns the premises.",
                "Governing law. Termination requires notice.",
                "IN WITNESS WHEREOF the parties sign.",
            ],
            "contract",
        ),
        (
            [
                "Abstract",
                "We study retrieval. Introduction follows.",
                "Related Work",
                "Experiments on a new dataset",
                "Results and Conclusion",
                "References",
                "Smith et al. (2020) arXiv",
            ],
            "research_paper",
        ),
        (
            [
                "Annual Report 2024-25",
                "Balance Sheet as at 31 March",
                "Statement of Profit and Loss",
                "Revenue from operations rose; EBITDA margin",
                "Earnings per share and dividend",
            ],
            "financial_report",
        ),
        (
            [
                "User Manual",
                "Safety instructions",
                "Installation",
                "Step 1: Press the power button",
                "Troubleshooting",
                "Specifications and maintenance",
            ],
            "manual",
        ),
        (["Meeting notes", "We talked about the weather and lunch plans."], "other"),
    ],
)
def test_classifies_common_document_types(lines, expected):
    result = classify(blocks(*lines))
    assert result.doc_type == expected
    if expected != "other":
        assert result.signals and 0 < result.confidence <= 1


def test_cleaning_drops_contents_lines_and_repeated_watermarks():
    pages = [Block(p, "Withdrawn") for p in range(1, 7)] + [
        Block(1, "4. Definitions ........................ 4"),
        Block(1, "Chapter II: General Requirements .......... 5"),
        Block(2, "4. Definitions"),
        Block(2, "In these Directions, unless the context otherwise requires."),
    ]
    assert [b.text for b in clean_blocks(pages)] == [
        "4. Definitions",
        "In these Directions, unless the context otherwise requires.",
    ]


def test_paper_strategy_skips_the_reference_list_and_knows_section_names():
    paper = strategy_for("research_paper")
    chunks = chunk_blocks(
        blocks("Introduction", "We propose a method.", "References", "[1] Smith. A paper. 2020."),
        paper.target,
        heading=paper.heading,
        stop_at=paper.stop_at,
    )
    assert [c.text for c in chunks] == ["We propose a method."]
    assert chunks[0].section == "Introduction"


def test_dates_in_common_formats():
    assert find_date("Issued on May 8, 2025 at Mumbai") == "2025-05-08"
    assert find_date("dated 2nd September 2022") == "2022-09-02"
    assert find_date("as of 2024-03-31") == "2024-03-31"
    assert find_date("on February 30, 2024") is None


def test_junk_pdf_titles_fall_back_to_the_first_page():
    meta = extract_metadata(
        blocks("Master Services Agreement between Acme Ltd and Beta LLP"),
        "contract",
        "Microsoft Word - draft_v3.docx",
        "draft.pdf",
    )
    assert meta.title == "Master Services Agreement between Acme Ltd and Beta LLP"


def record(doc_id: str, **kw) -> DocumentRecord:
    base = dict(
        sha256=doc_id,
        filename="f.pdf",
        title=doc_id,
        page_count=1,
        chunk_count=1,
        size_bytes=1,
        uploaded_at="2026-01-01T00:00:00+00:00",
    )
    return DocumentRecord(id=doc_id, **{**base, **kw})


def test_lineage_by_id_or_reference_and_newest_successor_wins():
    docs = [
        record("DOC-OLD", reference="RBI/2022-23/111", doc_date="2022-09-02"),
        record("DOC-MID", supersedes=("rbi/2022-23/111",), doc_date="2024-01-01"),
        record("DOC-NEW", supersedes=("DOC-OLD",), doc_date="2025-05-08"),
        record("DOC-ALONE"),
    ]
    s = derive_statuses(docs)
    assert (s["DOC-OLD"].status, s["DOC-OLD"].superseded_by) == ("superseded", "DOC-NEW")
    assert s["DOC-NEW"].status == "active" and s["DOC-NEW"].versioned
    assert not s["DOC-ALONE"].versioned


def test_prompt_carries_type_rules_and_version_status():
    docs = {
        "DOC-OLD": record("DOC-OLD", doc_type="regulation", doc_date="2022-09-02"),
        "DOC-NEW": record("DOC-NEW", doc_type="regulation", supersedes=("DOC-OLD",)),
    }
    hit = SimpleNamespace(chunk=SimpleNamespace(doc_id="DOC-OLD", page=2, section="10. Cooling-off", text="t"))
    context = format_context([hit], docs, derive_statuses(docs.values()))
    assert "Type: Regulation" in context and "Status: superseded" in context and "Superseded by: DOC-NEW" in context
    rules = type_rules(["regulation", "regulation", "other", "contract"])
    assert rules.startswith("5. For regulation excerpts") and "6. For contract excerpts" in rules and "7." not in rules


@pytest.fixture
def lib(tmp_path):
    return Library(tmp_path, HashEmbedder(), 5_000_000, 50)


def test_upload_records_type_and_metadata(lib):
    data = make_pdf(
        [
            [
                "This Agreement is made by and between Acme Ltd and the Tenant.",
                "WHEREAS the Landlord owns the premises. Governing law applies.",
                "Termination. IN WITNESS WHEREOF the parties sign on May 8, 2025.",
            ]
        ]
    )
    rec, _ = lib.add_pdf(data, "lease.pdf")
    assert rec.doc_type == "contract" and rec.type_signals and rec.doc_date == "2025-05-08"


def test_editing_type_reindexes_and_marks_fields_edited(lib):
    rec, _ = lib.add_pdf(make_pdf([["Introduction", "We propose a method.", "References", "[1] Smith 2020."]]), "notes.pdf")
    before = {c.text for c in lib._store.all_chunks()}
    updated = lib.update(rec.id, {"doc_type": "research_paper", "issuer": "Example University"})
    after = {c.text for c in lib._store.all_chunks()}
    assert updated.doc_type == "research_paper" and set(updated.edited) == {"doc_type", "issuer"}
    assert not any("Smith" in t for t in after) and before != after
    assert lib.search("propose method")[0].chunk.doc_id == rec.id


def test_type_change_without_original_is_refused(lib):
    rec, _ = lib.add_pdf(make_pdf([["Some body text about contracts and obligations."]]), "a.pdf")
    (lib._files / f"{rec.id}.pdf").unlink()
    with pytest.raises(ReindexUnavailable):
        lib.update(rec.id, {"doc_type": "manual"})
    assert lib.update(rec.id, {"title": "Renamed"}).title == "Renamed"


def test_patch_endpoint_validates_and_reports_lineage(lib, monkeypatch):
    monkeypatch.setitem(app.dependency_overrides, library_api.get_library, lambda: lib)
    client = TestClient(app)
    old, _ = lib.add_pdf(make_pdf([["Old circular text on lending rules."]]), "old.pdf")
    new, _ = lib.add_pdf(make_pdf([["New directions text on lending rules."]]), "new.pdf")

    assert client.patch(f"/documents/{old.id}", json={"reference": "RBI/2022-23/111"}).status_code == 200
    res = client.patch(f"/documents/{new.id}", json={"supersedes": ["RBI/2022-23/111", " "], "doc_date": "2025-05-08"})
    assert res.status_code == 200 and res.json()["supersedes"] == ["RBI/2022-23/111"]
    listed = {d["id"]: d for d in client.get("/documents").json()}
    assert listed[old.id]["status"] == "superseded" and listed[old.id]["superseded_by"] == new.id

    assert client.patch(f"/documents/{new.id}", json={"doc_date": "2025-13-40"}).status_code == 422
    assert client.patch(f"/documents/{new.id}", json={"doc_type": "poem"}).status_code == 422
    assert client.patch(f"/documents/{new.id}", json={"title": "   "}).status_code == 422
    assert client.patch("/documents/DOC-00000000", json={"title": "x"}).status_code == 404


def test_existing_library_is_migrated_in_place(tmp_path):
    import sqlite3

    db = tmp_path / "library.db"
    conn = sqlite3.connect(db)
    conn.executescript(
        "CREATE TABLE documents (id TEXT PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, filename TEXT NOT NULL,"
        " title TEXT NOT NULL, page_count INTEGER NOT NULL, chunk_count INTEGER NOT NULL,"
        " size_bytes INTEGER NOT NULL, uploaded_at TEXT NOT NULL);"
        "INSERT INTO documents VALUES ('DOC-AAAAAAAA','h','a.pdf','A',1,1,10,'2026-10-01T00:00:00+00:00');"
    )
    conn.commit()
    conn.close()
    from src.docqa.store import DocumentStore

    store = DocumentStore(db)
    (doc,) = store.list_documents()
    assert doc.doc_type == "other" and doc.supersedes == () and doc.edited == ()
    store.update(doc.id, {"supersedes": ("X",), "edited": ("supersedes",)})
    assert store.get(doc.id).supersedes == ("X",)


def test_years_and_dates_are_not_clause_headings():
    from src.docqa.chunking import is_heading

    assert is_heading("10. Cooling-off period") and is_heading("4.2.1 Scope")
    assert not is_heading("2021 dated September 24, 2021")
    assert not is_heading("02.09.2022 Guidelines on Digital Lending")
