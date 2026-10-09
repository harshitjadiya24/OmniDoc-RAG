"""Background ingestion: uploads return at once and are processed by a small worker pool."""

import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from threading import Lock

from src.docqa.extract import PdfError
from src.docqa.store import DocumentRecord

Progress = Callable[[str], None]
MAX_JOBS = 500


@dataclass(frozen=True)
class Job:
    id: str
    user_id: str
    filename: str
    status: str  # queued | processing | done | failed
    stage: str
    created_at: str
    document: DocumentRecord | None = None
    already_indexed: bool = False
    error: str | None = None
    finished: bool = field(default=False)


class JobQueue:
    def __init__(self, workers: int = 2):
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="ingest")
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()

    def _set(self, job_id: str, **changes) -> None:
        with self._lock:
            self._jobs[job_id] = replace(self._jobs[job_id], **changes)

    def submit(self, user_id: str, filename: str, work: Callable[[Progress], tuple[DocumentRecord, bool]]) -> Job:
        job = Job(
            f"job_{uuid.uuid4().hex[:12]}",
            user_id,
            filename,
            "queued",
            "Waiting to start",
            datetime.now(UTC).isoformat(timespec="seconds"),
        )
        with self._lock:
            if len(self._jobs) >= MAX_JOBS:  # forget the oldest finished jobs
                for old in [j.id for j in self._jobs.values() if j.finished][: MAX_JOBS // 5]:
                    del self._jobs[old]
            self._jobs[job.id] = job

        def run() -> None:
            self._set(job.id, status="processing", stage="Reading the PDF")
            try:
                record, created = work(lambda stage: self._set(job.id, stage=stage))
                self._set(job.id, status="done", stage="Ready", document=record, already_indexed=not created, finished=True)
            except PdfError as exc:
                self._set(job.id, status="failed", stage="Failed", error=str(exc), finished=True)
            except Exception as exc:  # unexpected: report without internals
                self._set(
                    job.id, status="failed", stage="Failed", error=f"Indexing failed ({type(exc).__name__}).", finished=True
                )

        self._pool.submit(run)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)
