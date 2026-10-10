"""Document library: ingest PDFs of any kind, then search them."""

import hashlib
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Protocol

import chromadb

from src.docqa.chunking import Chunk, chunk_blocks
from src.docqa.doctypes.classify import classify
from src.docqa.doctypes.lineage import VersionStatus, derive_statuses
from src.docqa.doctypes.metadata import extract_metadata
from src.docqa.doctypes.strategies import clean_blocks, strategy_for
from src.docqa.extract import Block, ExtractedPdf, PdfError, extract_pdf
from src.docqa.rerank import Reranker
from src.docqa.retrieval import Bm25Index, Hit, reciprocal_rank_fusion
from src.docqa.store import DocumentRecord, DocumentStore, StoredChunk


class Embedder(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class UploadTooLarge(PdfError):
    pass


class ReindexUnavailable(Exception):
    """The type changed but the original PDF is not stored, so the document cannot be re-chunked."""


def _chunk(blocks: list[Block], doc_type: str) -> list[Chunk]:
    strategy = strategy_for(doc_type)
    return chunk_blocks(clean_blocks(blocks), strategy.target, heading=strategy.heading, stop_at=strategy.stop_at)


def _page_texts(blocks: list[Block]) -> dict[int, str]:
    pages: dict[int, list[str]] = {}
    for block in blocks:
        pages.setdefault(block.page, []).append(block.text)
    return {page: "\n".join(texts) for page, texts in pages.items()}


class Library:
    def __init__(
        self,
        directory: Path,
        embedder: Embedder,
        max_bytes: int,
        max_pages: int,
        *,
        ocr_max_pages: int = 0,
        tables: bool = True,
        reranker: Reranker | None = None,
    ):
        directory.mkdir(parents=True, exist_ok=True)
        self._store = DocumentStore(directory / "library.db")
        self._files = directory / "files"
        self._files.mkdir(exist_ok=True)
        self._vectors = chromadb.PersistentClient(path=str(directory / "vectors")).get_or_create_collection(
            "library", metadata={"hnsw:space": "cosine"}
        )
        self._embedder = embedder
        self._max_bytes = max_bytes
        self._max_pages = max_pages
        self._ocr_max_pages = ocr_max_pages
        self._tables = tables
        self._reranker = reranker
        self._lock = RLock()
        self._bm25: Bm25Index | None = None
        self._chunks_by_key: dict[str, StoredChunk] = {}

    def _refresh(self) -> None:
        chunks = self._store.all_chunks()
        self._chunks_by_key = {c.key: c for c in chunks}
        self._bm25 = Bm25Index(chunks)

    def _index(self) -> Bm25Index:
        if self._bm25 is None:
            self._refresh()
        assert self._bm25 is not None
        return self._bm25

    def file_path(self, doc_id: str) -> Path | None:
        """The stored original, if this document has one (documents indexed before files were kept do not)."""
        if self._store.get(doc_id) is None:
            return None
        path = self._files / f"{doc_id}.pdf"
        return path if path.is_file() else None

    def page_text(self, doc_id: str, page: int) -> str:
        return self._store.page_text(doc_id, page)

    def list_documents(self) -> list[DocumentRecord]:
        return self._store.list_documents()

    def get_document(self, doc_id: str) -> DocumentRecord | None:
        return self._store.get(doc_id)

    def generate_summary(self, doc_id: str, llm, max_chars: int | None = None) -> DocumentRecord | None:
        """Summarise the document and suggest example questions with the given LLM, then store both.
        Best-effort: on model failure the document is left without a summary."""
        from src.docqa.summarize import summarize_document

        record = self._store.get(doc_id)
        if record is None:
            return None
        text = self._store.document_text(doc_id)
        summary, questions = summarize_document(llm, record.title, text[:max_chars] if max_chars else text)
        self._store.update(doc_id, {"summary": summary, "example_questions": tuple(questions)})
        return self._store.get(doc_id)

    def add_pdf(self, data: bytes, filename: str, progress: Callable[[str], None] | None = None) -> tuple[DocumentRecord, bool]:
        """Returns (record, created). Re-uploading identical bytes returns the existing record,
        restoring its stored original and page text if it was indexed before those were kept."""
        if len(data) > self._max_bytes:
            raise UploadTooLarge(f"The file exceeds the {self._max_bytes // (1024 * 1024)} MB limit.")
        digest = hashlib.sha256(data).hexdigest()
        with self._lock:
            existing = self._store.by_hash(digest)
            if existing:
                original = self._files / f"{existing.id}.pdf"
                if not original.is_file():
                    self._store.add_pages(existing.id, _page_texts(self._extract(data).blocks))
                    original.write_bytes(data)
                return existing, False
        report = progress or (lambda stage: None)
        report("Reading the PDF")
        extracted = self._extract(data)
        report("Detecting the document type")
        cleaned = clean_blocks(extracted.blocks)
        kind = classify(cleaned, filename)
        chunks = _chunk(extracted.blocks, kind.doc_type)
        if not chunks:
            raise PdfError("The PDF contains no body text to index.")
        meta = extract_metadata(cleaned, kind.doc_type, extracted.title, filename)
        record = DocumentRecord(
            id=f"DOC-{uuid.uuid4().hex[:8].upper()}",
            sha256=digest,
            filename=filename[:255],
            title=meta.title,
            page_count=extracted.page_count,
            chunk_count=len(chunks),
            size_bytes=len(data),
            uploaded_at=datetime.now(UTC).isoformat(timespec="seconds"),
            doc_type=kind.doc_type,
            type_confidence=kind.confidence,
            type_signals=tuple(kind.signals),
            issuer=meta.issuer,
            doc_date=meta.doc_date,
            reference=meta.reference,
            ocr_pages=extracted.ocr_pages,
        )
        report(f"Embedding {len(chunks)} passages")
        embeddings = self._embed(chunks)
        with self._lock:
            self._add_vectors(record.id, chunks, embeddings)
            (self._files / f"{record.id}.pdf").write_bytes(data)
            self._store.add(record, chunks, _page_texts(extracted.blocks))
            self._bm25 = None
        return record, True

    @property
    def can_rerank(self) -> bool:
        return self._reranker is not None

    def _extract(self, data: bytes) -> ExtractedPdf:
        return extract_pdf(data, self._max_pages, self._ocr_max_pages, self._tables)

    def _embed(self, chunks: list[Chunk]) -> list[list[float]]:
        return self._embedder.embed_documents([f"{c.section}\n{c.text}" if c.section else c.text for c in chunks])

    def _add_vectors(self, doc_id: str, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
        self._vectors.add(
            ids=[f"{doc_id}:{c.ordinal}" for c in chunks],
            embeddings=embeddings,
            metadatas=[{"doc_id": doc_id} for _ in chunks],
        )

    def update(self, doc_id: str, changes: dict[str, object]) -> DocumentRecord | None:
        """Apply user edits. A new type re-chunks and re-embeds the document from its stored original."""
        record = self._store.get(doc_id)
        if record is None:
            return None
        changed = {k: v for k, v in changes.items() if getattr(record, k) != v}
        new_type = changed.get("doc_type")
        if isinstance(new_type, str):
            original = self.file_path(doc_id)
            if original is None:
                raise ReindexUnavailable("The original PDF is not stored. Upload it again, then change the type.")
            chunks = _chunk(self._extract(original.read_bytes()).blocks, new_type)
            if not chunks:
                raise PdfError("The PDF contains no body text to index with this type.")
            embeddings = self._embed(chunks)
            with self._lock:
                self._vectors.delete(where={"doc_id": doc_id})
                self._add_vectors(doc_id, chunks, embeddings)
                self._store.replace_chunks(doc_id, chunks)
                self._bm25 = None
        if changed:
            edited = tuple(sorted(set(record.edited) | set(changed)))
            self._store.update(doc_id, {**changed, "edited": edited})
        return self._store.get(doc_id)

    def statuses(self) -> dict[str, VersionStatus]:
        return derive_statuses(self._store.list_documents())

    def delete(self, doc_id: str) -> bool:
        with self._lock:
            if not self._store.delete(doc_id):
                return False
            self._vectors.delete(where={"doc_id": doc_id})
            (self._files / f"{doc_id}.pdf").unlink(missing_ok=True)
            self._bm25 = None
            return True

    def search_each(self, question: str, doc_ids: list[str], per_doc: int, **options) -> list[Hit]:
        """Search every document on its own and interleave the results, so no document is crowded out."""
        results = [self.search(question, {doc_id}, per_doc, **options) for doc_id in doc_ids]
        return [hits[i] for i in range(per_doc) for hits in results if i < len(hits)]

    def search(
        self,
        question: str,
        doc_ids: set[str] | None = None,
        limit: int = 6,
        *,
        mode: str = "hybrid",
        rerank: bool = False,
        rewritten: str | None = None,
    ) -> list[Hit]:
        """mode: dense | bm25 | hybrid (reciprocal rank fusion). `rewritten` adds keywords to the BM25 query.
        rerank re-scores the top of the candidate pool with the cross-encoder."""
        with self._lock:
            bm25 = self._index()
            by_key = self._chunks_by_key
        pool = max(limit * 4, 20)
        rankings: list[list[str]] = []
        if mode in ("bm25", "hybrid"):
            keywords = f"{question} {rewritten}" if rewritten else question
            rankings.append(bm25.search(keywords, doc_ids, pool))
        if mode in ("dense", "hybrid"):
            rankings.append(self._dense(question, doc_ids, pool))
        fused = [(key, score) for key, score in reciprocal_rank_fusion(rankings) if key in by_key]
        if rerank and self._reranker is not None and fused:
            candidates = [key for key, _ in fused[:pool]]
            scores = self._reranker.score(question, [by_key[k].text for k in candidates])
            fused = sorted(zip(candidates, scores, strict=True), key=lambda pair: pair[1], reverse=True)
        return [Hit(by_key[key], score) for key, score in fused[:limit]]

    def _dense(self, question: str, doc_ids: set[str] | None, pool: int) -> list[str]:
        total = self._vectors.count()
        if not total:
            return []
        where = {"doc_id": {"$in": sorted(doc_ids)}} if doc_ids is not None else None
        result = self._vectors.query(
            query_embeddings=[self._embedder.embed_query(question)], n_results=min(pool, total), where=where
        )
        return result["ids"][0]
