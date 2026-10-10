"""Each user's documents: POST/GET/PATCH/DELETE /documents, upload jobs, and the original files."""

from dataclasses import asdict
from datetime import date
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from src.api.limits import limit
from src.auth.session import current_user
from src.auth.users import User
from src.config import settings
from src.docqa.doctypes.lineage import VersionStatus
from src.docqa.embed import FastEmbedWrapper
from src.docqa.engine import Library, ReindexUnavailable, UploadTooLarge
from src.docqa.extract import PdfError
from src.docqa.jobs import Job, JobQueue
from src.docqa.rerank import FastEmbedReranker
from src.docqa.store import DocumentRecord

router = APIRouter(prefix="/documents", tags=["documents"])

DocType = Literal["contract", "research_paper", "financial_report", "regulation", "manual", "other"]


@lru_cache(maxsize=1)
def _models() -> tuple[FastEmbedWrapper, FastEmbedReranker]:
    """Embedding and rerank models are loaded once and shared by every user's library."""
    return FastEmbedWrapper("BAAI/bge-small-en-v1.5"), FastEmbedReranker(settings.RERANK_MODEL)


@lru_cache(maxsize=256)
def library_for(user_id: str) -> Library:
    """The local single user keeps the original library directory; accounts get their own."""
    directory = settings.LIBRARY_DIR if user_id == "local" else settings.LIBRARY_DIR / "users" / user_id
    embedder, reranker = _models()
    return Library(
        directory,
        embedder,
        max_bytes=settings.MAX_UPLOAD_MB * 1024 * 1024,
        max_pages=settings.MAX_PDF_PAGES,
        ocr_max_pages=settings.OCR_MAX_PAGES,
        tables=settings.EXTRACT_TABLES,
        reranker=reranker,
    )


def get_library(user: User = Depends(current_user)) -> Library:
    return library_for(user.id)


@lru_cache(maxsize=1)
def job_queue() -> JobQueue:
    return JobQueue(workers=2)


class DocumentOut(BaseModel):
    id: str
    filename: str
    title: str
    page_count: int
    chunk_count: int
    size_bytes: int
    uploaded_at: str
    doc_type: DocType
    type_confidence: float
    type_signals: list[str]
    issuer: str | None
    doc_date: str | None
    reference: str | None
    supersedes: list[str]
    edited: list[str]
    ocr_pages: int
    summary: str | None
    example_questions: list[str]
    status: Literal["active", "superseded"]
    superseded_by: str | None
    already_indexed: bool = False


class JobOut(BaseModel):
    id: str
    filename: str
    status: Literal["queued", "processing", "done", "failed"]
    stage: str
    document: DocumentOut | None = None
    error: str | None = None


class DocumentUpdate(BaseModel):
    """Fields a user may correct. Omitted fields are left alone; null clears an optional field."""

    title: str | None = Field(None, min_length=1, max_length=200)
    doc_type: DocType | None = None
    issuer: str | None = Field(None, max_length=200)
    doc_date: str | None = None
    reference: str | None = Field(None, max_length=120)
    supersedes: list[str] | None = Field(None, max_length=20)

    @field_validator("title", "issuer", "reference")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return " ".join(value.split()) or None if value is not None else None

    @field_validator("doc_date")
    @classmethod
    def _iso_date(cls, value: str | None) -> str | None:
        if value:
            date.fromisoformat(value)
        return value or None

    @field_validator("supersedes")
    @classmethod
    def _entries(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = list(dict.fromkeys(e.strip() for e in value if e.strip()))
        if any(len(e) > 120 for e in cleaned):
            raise ValueError("Each superseded document ID or reference must be 120 characters or fewer.")
        return cleaned


def _out(record: DocumentRecord, version: VersionStatus | None, already: bool = False) -> DocumentOut:
    data = asdict(record)
    data.pop("sha256")
    return DocumentOut(
        **data,
        status=version.status if version else "active",
        superseded_by=version.superseded_by if version else None,
        already_indexed=already,
    )


def _job_out(job: Job, library: Library) -> JobOut:
    document = _out(job.document, library.statuses().get(job.document.id), job.already_indexed) if job.document else None
    return JobOut(id=job.id, filename=job.filename, status=job.status, stage=job.stage, document=document, error=job.error)


def _ingest(library: Library, data: bytes, filename: str, progress=lambda _s: None) -> tuple[DocumentRecord, bool]:
    """Index the PDF, then (best-effort) generate a summary and example questions with the configured model."""
    record, created = library.add_pdf(data, filename, progress)
    if created:
        progress("Summarizing the document")
        try:
            from src.llm.providers import ProviderUnavailable, chat_model, summary_chars

            # A dedicated summarise model: reasoning off and a bounded cap, so a local
            # reasoning model does not loop on the JSON prompt and stall the upload.
            llm = chat_model(settings.LLM_PROVIDER, settings, summarize=True)
            updated = library.generate_summary(record.id, llm, max_chars=summary_chars(settings.LLM_PROVIDER, settings))
            if updated is not None:
                record = updated
        except ProviderUnavailable:
            pass  # no model configured: the document is still fully usable, just without a summary
    return record, created


@router.post("", status_code=201, response_model=None)
def upload(
    file: UploadFile = File(...),
    wait: bool = Query(False, description="Index before responding (201) instead of returning a job (202)."),
    user: User = Depends(current_user),
    library: Library = Depends(get_library),
) -> DocumentOut | JSONResponse:
    limit(f"upload:{user.id}", settings.UPLOADS_PER_HOUR, 3600)
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"The file exceeds the {settings.MAX_UPLOAD_MB} MB limit.")
    if not data.startswith(b"%PDF"):
        raise HTTPException(422, "The file is not a PDF.")
    filename = file.filename or "document.pdf"
    if wait:
        try:
            record, created = _ingest(library, data, filename)
        except UploadTooLarge as exc:
            raise HTTPException(413, str(exc)) from exc
        except PdfError as exc:
            raise HTTPException(422, str(exc)) from exc
        return _out(record, library.statuses().get(record.id), already=not created)
    job = job_queue().submit(user.id, filename, lambda progress: _ingest(library, data, filename, progress))
    return JSONResponse(_job_out(job, library).model_dump(), status_code=202)


@router.get("/jobs/{job_id}", response_model=JobOut)
def upload_job(job_id: str, user: User = Depends(current_user), library: Library = Depends(get_library)) -> JobOut:
    job = job_queue().get(job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(404, "Upload not found.")
    return _job_out(job, library)


@router.get("", response_model=list[DocumentOut])
def list_documents(library: Library = Depends(get_library)) -> list[DocumentOut]:
    statuses = library.statuses()
    return [_out(r, statuses.get(r.id)) for r in library.list_documents()]


@router.patch("/{doc_id}", response_model=DocumentOut)
def update_document(doc_id: str, body: DocumentUpdate, library: Library = Depends(get_library)) -> DocumentOut:
    changes = {name: getattr(body, name) for name in body.model_fields_set}
    if "title" in changes and not changes["title"]:
        raise HTTPException(422, "A title is required.")
    if "doc_type" in changes and changes["doc_type"] is None:
        raise HTTPException(422, "A document type is required.")
    if "supersedes" in changes:
        changes["supersedes"] = tuple(changes["supersedes"] or ())
    try:
        record = library.update(doc_id, changes)
    except ReindexUnavailable as exc:
        raise HTTPException(409, str(exc)) from exc
    except PdfError as exc:
        raise HTTPException(422, str(exc)) from exc
    if record is None:
        raise HTTPException(404, "Document not found.")
    return _out(record, library.statuses().get(record.id))


@router.get("/{doc_id}/file")
def document_file(doc_id: str, library: Library = Depends(get_library)) -> FileResponse:
    path = library.file_path(doc_id)
    if path is None:
        raise HTTPException(404, "The original PDF is not stored for this document. Upload it again to view it.")
    return FileResponse(path, media_type="application/pdf", headers={"Cache-Control": "private, max-age=3600"})


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str, library: Library = Depends(get_library)) -> None:
    if not library.delete(doc_id):
        raise HTTPException(404, "Document not found.")
