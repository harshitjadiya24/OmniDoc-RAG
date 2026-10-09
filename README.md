# OmniDoc-RAG

A robust, version-aware RAG platform for document analysis. Upload any PDF to get streaming, clause-cited answers. Features automatic document classification, side-by-side comparison, and strict citation checking against source pages.

## Features

- **General-Purpose Ingestion:** PyMuPDF text extraction with page numbers, ruled tables kept as rows, and Tesseract OCR for scanned pages.
- **Auto-Classification & Metadata:** Contracts, research papers, financial reports, regulations, and manuals are detected automatically and handled with specialized chunking strategies.
- **Advanced Retrieval:** Dense (bge-small), BM25, or hybrid search with reciprocal rank fusion. Optional cross-encoder reranking and query rewriting. Multi-document questions search each document separately to prevent crowding out.
- **Evidence Verification (Citation Checks):** Powered by a local Ollama model (default) or Google Gemini. Every claim cites `[DOC-…, p. N]`, and a dedicated page check evaluates each citation as supported, partial, or unsupported against the actual text.
- **Side-by-Side Comparison:** Compare two versions of a document or two different documents to highlight differences, shared clauses, and unique sections.

## Run locally

```bash
# API (Python 3.12)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
# default uses local Ollama (qwen3:1.7b); for Gemini: echo "GEMINI_API_KEY=... " >> .env && echo "LLM_PROVIDER=gemini" >> .env
.venv/bin/uvicorn src.api.main:app --port 8000

# Web app (Node 22)
cd frontend
npm ci && npm run dev                    # http://localhost:3000 (product site), /app (workspace)
```

Locally there are no accounts: one user and one library in `backend/data/library`.

## Deploy with Docker Compose

```bash
cp .env.example .env    # set SECRET_KEY (openssl rand -hex 32) and a model key
docker compose up --build
```

This runs the API and the web app with accounts on. Each user has a private library in the `library` volume. Uploads are indexed in the background and the page shows their progress.

| Setting | Default | Purpose |
|---|---|---|
| `AUTH_ENABLED` | `false` (`true` in Compose) | Email and password accounts with signed session tokens |
| `SECRET_KEY` | none | Signs session tokens; at least 32 characters when accounts are on |
| `CORS_ORIGINS` | localhost:3000 | Browser origins allowed to call the API (comma separated) |
| `ASK_PER_MINUTE`, `UPLOADS_PER_HOUR` | 20, 30 | Rate limits per user |
| `LLM_PROVIDER` | `ollama` | `ollama` (local, default) or `gemini` |
| `MAX_UPLOAD_MB`, `MAX_PDF_PAGES`, `OCR_MAX_PAGES` | see `backend/src/config.py` | Upload limits |
| `LOG_JSON` | `true` | One JSON log line per request with a request ID |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Sends OpenTelemetry traces (install `requirements-otel.txt`) |

The API runs one worker because rate limits, upload jobs and library caches live in process memory. Running more replicas would need Redis and a shared vector store.

## Checks

- Backend: `cd backend && ruff check . && python -m pytest`
- Frontend: `cd frontend && npm run check && npx playwright test`

CI runs both (`.github/workflows/`) and builds the Docker images.
