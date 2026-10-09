# OmniDoc RAG

**Ask your PDFs questions in plain English, and check every answer.**

OmniDoc is a retrieval-augmented generation (RAG) app for your own documents. You upload PDFs (contracts, research papers, financial reports, regulations, manuals) and ask questions. The answer streams in, and:

- **every statement cites its source** as `[DOC-1A2B3C4D, p. 7]`,
- **every citation is checked** by re-reading the cited page and scoring how much of the statement actually appears there (supported, partial or unsupported),
- **missing evidence gets a refusal** instead of a confident guess.

By default everything runs on your machine: local embeddings, a local reranker and a local language model through Ollama. Nothing is sent to a cloud service unless you add a Gemini key and choose it.

---

## Contents

1. [What problem it solves](#what-problem-it-solves)
2. [Features](#features)
3. [Quick start (local)](#quick-start-local)
4. [Using the app](#using-the-app)
5. [How it works](#how-it-works)
6. [Configuration](#configuration)
7. [Deploying with Docker Compose](#deploying-with-docker-compose)
8. [API reference](#api-reference)
9. [Project structure](#project-structure)
10. [Testing and CI](#testing-and-ci)
11. [Troubleshooting](#troubleshooting)
12. [Limitations](#limitations)

---

## What problem it solves

| Problem | What OmniDoc does |
|---|---|
| A chatbot gives a fluent answer and you can't tell if it's true | The model may only use passages retrieved from your documents and must cite document and page. Afterwards each cited page is re-read and the statement is scored against it |
| RAG systems answer something even when nothing relevant was found | No passages means no model call and a refusal. If the model says the excerpts are insufficient, the app detects that and shows a refusal with suggestions |
| Keyword search misses paraphrases; semantic search misses exact IDs like "Clause 4.2.1" or "₹50,000" | BM25 keyword search and dense vector search run together and are merged with reciprocal rank fusion; a cross-encoder can re-score the top results |
| An old version of a document is quoted as if it were current | A document can declare which documents it supersedes. Superseded ones are labelled in the library, the evidence and the prompt, and the model is told to prefer the newer one |
| One chunking rule doesn't fit every document | Each upload is classified (contract, research paper, financial report, regulation, manual, other) and gets its own heading rules, passage size and answering instructions |
| Documents are private | The default stack is fully local |

The underlying task is **attributed (grounded) question answering over a closed, user-supplied corpus**: the model is not allowed to use outside knowledge and must point to where each claim came from.

---

## Features

**Ingestion**
- PyMuPDF text extraction that keeps page numbers; ruled tables kept as rows; Tesseract OCR for scanned pages
- Removal of running headers, footers, watermarks and table-of-contents lines
- Automatic document type detection that shows the phrases it matched
- Heading-aware chunking: every passage knows its page and section
- Detected title, date, issuer and reference number (editable)
- An automatic summary and four example questions per document
- Duplicate uploads detected by file hash
- Uploads processed in the background with live progress

**Asking**
- Hybrid retrieval (BM25 + `bge-small-en-v1.5` vectors, fused with RRF), or BM25 only, or dense only
- Optional cross-encoder rerank (`ms-marco-MiniLM-L-6-v2`) and optional query rewrite
- A planner that picks **single** (one search), **multi** (each document searched separately) or **compare** (two documents, four fixed sections: In both, Differences, Only in A, Only in B)
- Streaming answers over Server-Sent Events, with the pipeline stage shown live
- Per-citation page checks, the closest matching sentence, and a summary for the whole answer
- Multi-turn chats saved on the server
- Answer models: local Ollama (default) or Google Gemini

**Interface**
- A product site at `/` explaining the system with labelled demos
- A workspace at `/app` with a library, the conversation and an evidence pane
- A built-in PDF viewer that opens the cited page with the passage highlighted
- Dark and light themes, keyboard shortcuts (⌘K / Ctrl+K command palette), and phone layouts
- Built for accessibility: tested against WCAG 2.2 AA and supports reduced motion

**Operations**
- Optional email and password accounts with a private library per user
- Rate limits, restricted CORS, JSON request logs with request IDs, optional OpenTelemetry
- Docker images and a Compose file

---

## Quick start (local)

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Python | 3.12 | Backend API |
| Node.js | 22 | Frontend |
| [Ollama](https://ollama.com) | recent | Local answer model (skip if you will only use Gemini) |
| Tesseract | optional | OCR for scanned PDFs (`brew install tesseract` or `apt install tesseract-ocr`) |

### 1. Get the code

```bash
git clone https://github.com/harshitjadiya24/OmniDoc-RAG.git
cd OmniDoc-RAG
```

### 2. Start a local model

```bash
ollama pull qwen3:1.7b
ollama serve            # skip if the Ollama app is already running
```

Prefer Gemini? Skip this step and see [Using Gemini instead of Ollama](#using-gemini-instead-of-ollama).

### 3. Start the backend

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn src.api.main:app --port 8000
```

The first upload downloads the embedding model, and the first reranked question downloads the reranker (both small, both cached). Check it is up:

```bash
curl http://localhost:8000/api/health        # {"status":"ok"}
curl http://localhost:8000/llm/providers     # shows whether Ollama and the model are available
```

Interactive API docs are at http://localhost:8000/docs.

### 4. Start the frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:3000** for the product site and **http://localhost:3000/app** for the workspace.

Locally there are no accounts: one user and one library stored in `backend/data/library`.

---

## Using the app

### 1. Upload documents

In the **Library** pane (the left column, or the *Library* button on smaller screens), drop PDFs onto the upload area or click **Choose PDFs**. Each file shows its progress: *Reading the PDF → Detecting the document type → Embedding N passages → Summarizing → Ready*. New documents are selected automatically.

Click the **ⓘ** on a document to open its details:
- **Overview:** page and passage counts, why its type was chosen, the generated summary, and **questions this document answers** (click one to ask it)
- **Edit details:** correct the title, type, issuer, date or reference number. Changing the type re-chunks the document from the original PDF. Use **Supersedes** to list document IDs or reference numbers this document replaces
- **View PDF** and **Delete**

### 2. Choose what to ask about

Tick the documents to search. Above the upload area:
- **Ask** searches the selected documents. Words like *each*, *every*, *across* or *compare* in your question make the planner search them one by one.
- **Compare two** needs exactly two selected documents. A is the earlier one (by stated date, otherwise by upload time).

### 3. Ask

Type in the box at the bottom and press **Enter** (Shift+Enter adds a new line). The sliders icon on the left of the box opens the settings:

| Setting | Effect |
|---|---|
| Retrieval: Hybrid / Dense / BM25 | How passages are found. Hybrid is the best default |
| Rerank | A cross-encoder re-scores the candidates. Better ordering, about a second slower |
| Query rewrite | The model suggests extra search keywords (keyword search only). A few seconds slower |
| Answer model | Local Ollama or Gemini; unavailable models are disabled and say why |

While the answer streams you see the four stages (*Plan, Retrieve, Rank, Draft*). **Esc** or **Stop** cancels.

### 4. Read and check the answer

- Each citation is a small chip such as **✓ p.4**. Its colour and icon show the page check: green **Supported**, amber **Partial**, red **Unsupported**, grey **Page missing** or **Unchecked**. A dashed chip means **Unverified citation**: the cited page wasn't among the retrieved passages.
- Click a chip to see the coverage score, the closest sentence on that page, and buttons to **Show passage** or **View page N** (opens the PDF with the passage highlighted).
- Below the answer: the page check summary, *Citations resolved N of M*, passages used, latency, model and stream chunks. Each figure says whether the API reported it or the browser derived it.
- The **Evidence** pane lists every retrieved passage grouped by document, marked cited or not cited, with its verdict.

If the documents don't contain the answer you'll see a refusal with suggested questions. That is the system working as intended.

### 5. Chats

Every answer is saved to the current chat. The chat name at the top of the conversation opens your history; **New** starts a fresh chat. Follow-up questions in the same chat see the earlier questions and answers.

### Keyboard

| Keys | Action |
|---|---|
| ⌘K / Ctrl+K | Command palette: ask, new chat, upload, open library or evidence, switch theme, jump to chats and documents |
| Enter / Shift+Enter | Send / new line |
| Esc | Stop the answer, or close a panel |

---

## How it works

```
                 ┌───────────────────────── Ingestion (background job) ─────────────────────────┐
 PDF upload ───► │ Extract → Clean → Classify → Chunk → Metadata → Embed + index → Summarize  │ ──► SQLite + Chroma + original PDF
                 └───────────────────────────────────────────────────────────────────────────────┘

                 ┌──────────────────────────────── Asking (SSE stream) ─────────────────────────┐
 Question ─────► │ Plan → (Rewrite) → BM25 + dense → RRF → (Rerank) → Prompt → Stream → Verify │ ──► answer + citations + checks
                 └───────────────────────────────────────────────────────────────────────────────┘
```

### Ingestion

`POST /documents` returns `202` with a job; the browser polls `GET /documents/jobs/{id}` and shows each stage.

1. **Extract** (`docqa/extract.py`): PyMuPDF reads each page in layout order and tags every block with its page number. Ruled tables become `| a | b |` rows. A page with no text but with images is OCRed with Tesseract (up to `OCR_MAX_PAGES`). Password-protected, corrupt, oversized or text-less PDFs are rejected with a clear message.
2. **Clean** (`doctypes/strategies.py`): drops lines repeated on most pages (headers, footers, watermarks) and table-of-contents leader lines.
3. **Classify** (`doctypes/classify.py`): scores six types by distinctive phrases in the filename and first three pages. Confidence and the matched phrases are stored and shown.
4. **Chunk** (`chunking.py`): packs text into passages of about 700 to 1,100 characters (depending on type) under the nearest heading, with a small overlap. Tables split by row with the header repeated. Research papers stop at *References*.
5. **Metadata** (`doctypes/metadata.py`): best-effort title, date, issuer and reference number, labelled *Detected from the PDF* until edited.
6. **Embed and index** (`engine.py`): passages are embedded with `BAAI/bge-small-en-v1.5` into a Chroma collection and stored in SQLite (documents, passages and full page text). The original PDF is kept for the viewer and for re-chunking.
7. **Summarize** (`summarize.py`): one model call writes a summary and four example questions. If no model is available the document still works.
8. **Lineage** (`doctypes/lineage.py`): computed on read from each document's *supersedes* list; the newer document wins.

### Asking

`POST /ask/stream` returns Server-Sent Events in this order:

```
stage understanding
stage searching
plan     { mode, reason, documents, contributing, retrieval }
stage reranking
sources  { items: [...] }
stage drafting
token    { text } × many
done     { refused, usage, citations }      or      error { message }
```

1. **Plan** (`planner.py`): *compare* if you chose Compare (or two documents are selected and the question asks to compare), *multi* if several documents are selected and the question spans them, otherwise *single*. The reason is shown to you.
2. **Retrieve** (`engine.py`, `retrieval.py`): BM25 (with Lucene's non-negative IDF, so keyword search still works in a one-document library) and dense search each produce a ranked list; reciprocal rank fusion adds `1 / (60 + rank)` from each list. Multi and compare search each document separately so a long document can't crowd out the others.
3. **Rerank** (`rerank.py`, optional): the cross-encoder scores question and passage together and reorders the top candidates.
4. **Prompt** (`prompts.py`): the model gets only the excerpts, each headed with `[DOC-…, p. N] | Title | Type | Date | Status | Section`, plus rules: use only the excerpts, cite every statement, refuse with a fixed sentence if the answer isn't there, plus extra rules for each document type present (for example "say which party each obligation binds" for contracts). Earlier turns in the chat are included.
5. **Stream** (`stream.py`): tokens are forwarded as they arrive. Hidden reasoning tags from local models are stripped, and a model failure ends the stream with an `error` event carrying the provider's reason.
6. **Verify** (`verify.py`): for each citation, the statement before it is reduced to its content words (stopwords removed) and compared with the full text of the cited page. Coverage of 70% or more is **supported**, 40% or more is **partial**, below that **unsupported**. A page with no text is **not_found**, and statements with fewer than two content words are **unchecked**.

> The page check is word overlap, not proof of meaning. It catches citations to the wrong page and statements the page doesn't mention, but it cannot detect negation or paraphrase: "Interest is payable" scores as supported against a page saying "Interest is not payable". The interface says so wherever verdicts appear.

### Storage

Each library directory (`backend/data/library`, or `data/library/users/<id>` per account) contains:

| Path | Contents |
|---|---|
| `library.db` | SQLite: documents, passages, page text |
| `vectors/` | Chroma vector store |
| `files/<DOC-ID>.pdf` | Original uploads |
| `chats.db` | Saved chats |

Accounts are stored in `data/library/users.db`.

---

## Configuration

The backend reads environment variables or `backend/.env` (see `backend/src/config.py`).

| Setting | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | `ollama` or `gemini` |
| `OLLAMA_MODEL` | `qwen3:1.7b` | Local model name (must be pulled) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama address |
| `GEMINI_API_KEY` | empty | Enables Gemini |
| `GEMINI_MODEL` | `gemini-3.1-pro` | Gemini model |
| `LLM_MAX_TOKENS` | `2048` | Hard cap on answer length |
| `RERANK_MODEL` | `Xenova/ms-marco-MiniLM-L-6-v2` | Cross-encoder for rerank |
| `MAX_UPLOAD_MB` | `50` | Largest accepted file |
| `MAX_PDF_PAGES` | `1500` | Longest accepted PDF |
| `OCR_MAX_PAGES` | `30` | Scanned pages OCRed per upload (`0` turns OCR off) |
| `EXTRACT_TABLES` | `true` | Turn ruled tables into rows |
| `LIBRARY_DIR` | `backend/data/library` | Where documents, vectors and chats are stored |
| `AUTH_ENABLED` | `false` | Email and password accounts |
| `SECRET_KEY` | empty | Signs session tokens; at least 32 characters when accounts are on |
| `SESSION_HOURS` | `168` | Session lifetime |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Browser origins allowed to call the API |
| `ASK_PER_MINUTE` / `UPLOADS_PER_HOUR` | `20` / `30` | Rate limits per user |
| `LOG_JSON` | `true` | One JSON log line per request with an `X-Request-ID` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Sends OpenTelemetry traces (install `requirements-otel.txt`) |

The frontend reads these at build time (put them in `frontend/.env.local`):

| Setting | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend address |
| `NEXT_PUBLIC_GITHUB_URL` | unset | Shows a GitHub link in the header and footer |

### Using Gemini instead of Ollama

```bash
cd backend
echo "GEMINI_API_KEY=your-key" >> .env
echo "LLM_PROVIDER=gemini" >> .env     # optional: makes Gemini the default
```

Restart the API. With a key set, both models appear in the settings menu and can be chosen per question. Choosing Gemini sends the retrieved passages to Google.

### Using a different Ollama model

```bash
ollama pull llama3.1:8b
echo "OLLAMA_MODEL=llama3.1:8b" >> backend/.env
```

Larger models follow the citation format more reliably than the 1.7B default.

---

## Deploying with Docker Compose

```bash
cp .env.example .env
# edit .env: set SECRET_KEY (openssl rand -hex 32) and, if you want Gemini, GEMINI_API_KEY
docker compose up --build
```

- Web app: http://localhost:3000, API: http://localhost:8000
- Accounts are **on** in Compose: register in the workspace; each user gets a private library.
- Data lives in the `library` Docker volume.
- The API container reaches Ollama on your host through `host.docker.internal:11434`. Make sure Ollama is running and the model is pulled on the host.
- To serve from another host name, set `PUBLIC_WEB_URL` (allowed CORS origin) and `PUBLIC_API_URL` (compiled into the web build) in `.env`, then rebuild.

The backend image includes Tesseract and pre-downloads the embedding and rerank models.

The API deliberately runs **one worker**: rate limits, upload jobs and caches live in process memory. Running several replicas would need Redis and a shared vector store.

---

## API reference

Full schemas are at `http://localhost:8000/docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/documents` | Upload a PDF (multipart `file`). `202` with a job, or `201` with `?wait=true` |
| `GET` | `/documents/jobs/{id}` | Upload job status and stage |
| `GET` | `/documents` | List documents with type, metadata, summary and version status |
| `PATCH` | `/documents/{id}` | Edit title, type, issuer, date, reference or supersedes |
| `GET` | `/documents/{id}/file` | The original PDF |
| `DELETE` | `/documents/{id}` | Delete a document |
| `POST` | `/ask/stream` | Ask a question; Server-Sent Events (see [Asking](#asking)) |
| `GET` / `POST` | `/chats` | List or create chats |
| `GET` / `DELETE` | `/chats/{id}` | Read or delete a chat |
| `POST` | `/chats/{id}/messages` | Save a question and answer turn |
| `GET` | `/llm/providers` | Which answer models are available, and why not |
| `GET` | `/auth/config` | Whether accounts are on |
| `POST` | `/auth/register`, `/auth/login` | Get a bearer token |
| `GET` | `/auth/me` | The signed-in user |

Example request:

```bash
curl -N http://localhost:8000/ask/stream \
  -H 'Content-Type: application/json' \
  -d '{"question":"When is the deposit refunded?","mode":"hybrid","rerank":true,"document_ids":[],"task":"ask"}'
```

An empty `document_ids` searches every document. `task: "compare"` needs exactly two IDs. With accounts on, add `-H 'Authorization: Bearer <token>'`.

---

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── api/            FastAPI app and routers (documents, ask, chats, auth, providers, rate limits)
│   │   ├── docqa/          the RAG core
│   │   │   ├── extract.py      PDF text, tables, OCR
│   │   │   ├── chunking.py     heading- and page-aware passages
│   │   │   ├── doctypes/       classify, per-type strategies, metadata, lineage
│   │   │   ├── engine.py       the Library: ingest, store, search
│   │   │   ├── retrieval.py    BM25 and reciprocal rank fusion
│   │   │   ├── rerank.py       cross-encoder
│   │   │   ├── rewrite.py      optional query rewrite
│   │   │   ├── planner.py      single / multi / compare
│   │   │   ├── prompts.py      answer and compare prompts
│   │   │   ├── stream.py       the SSE event stream
│   │   │   ├── verify.py       citation page checks
│   │   │   ├── summarize.py    summary and example questions
│   │   │   ├── chats.py, jobs.py, store.py, embed.py, textutil.py
│   │   ├── llm/            Ollama and Gemini providers
│   │   ├── auth/           users and signed sessions
│   │   └── observability/  JSON logs and OpenTelemetry
│   ├── tests/              pytest suite
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/            routes: (site) product page, app/ workspace
│   │   ├── components/     landing/, workspace/ (library, conversation, evidence, pdf, account), ui/
│   │   ├── lib/api/        typed API client, SSE stream, zod schemas
│   │   ├── lib/rag/        citation parsing, check matching, PDF highlighting
│   │   └── stores/         zustand state (conversation, library, chats, evidence, settings)
│   ├── tests/              vitest unit tests and Playwright end-to-end tests
│   ├── docs/               ARCHITECTURE.md, DESIGN.md
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

More detail on the frontend: [frontend/docs/ARCHITECTURE.md](frontend/docs/ARCHITECTURE.md) and [frontend/docs/DESIGN.md](frontend/docs/DESIGN.md).

---

## Testing and CI

```bash
# Backend: lint and tests (no model or network needed; tests use fake models)
cd backend
.venv/bin/ruff check . && .venv/bin/python -m pytest

# Frontend: typecheck, lint, unit tests, production build, Playwright
cd frontend
npx playwright install chromium     # first time only
npm run check
```

The Playwright suite stubs the API, so it needs no backend. It builds and serves its own production server on port 3200, so a running `npm run dev` doesn't interfere. It covers answering, citation checks, the PDF viewer, refusals, failures, compare, uploads, editing, chats, sign-in, the command palette, accessibility checks in both themes, and layout from 320 to 2560 px wide.

GitHub Actions (`.github/workflows/`) runs both suites and builds the Docker images.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Workspace says **"The API isn't answering"** | Start the backend on port 8000, or set `NEXT_PUBLIC_API_URL` to where it runs |
| Browser console shows a CORS error | Add your frontend address to `CORS_ORIGINS` and restart the API |
| Model shows as unavailable in settings | `ollama serve` is not running, or the model isn't pulled: `ollama pull qwen3:1.7b` |
| Asking returns a 422 | The chosen provider isn't configured (for example Gemini without `GEMINI_API_KEY`), or Compare doesn't have exactly two documents |
| Upload fails with "No selectable text… OCR is not available" | Install Tesseract, or the PDF is image-only with OCR turned off (`OCR_MAX_PAGES=0`) |
| "View PDF" says the original isn't stored | The document was uploaded before originals were kept; upload it again |
| Answers are slow | The local model runs on your CPU or GPU; turn off rerank and query rewrite, or use a smaller or faster model |
| Citations often show as **Unverified** | Small local models sometimes mistype IDs or pages; a larger model follows the format better |
| A 429 error | Rate limit reached (`ASK_PER_MINUTE`, `UPLOADS_PER_HOUR`); wait or raise the limit |

---

## Limitations

- The page check measures word overlap, not meaning. It can't detect negation, paraphrase or reasoning errors. Read the passage when it matters.
- Answers are generated by a language model and can be wrong even when cited. This is not legal or financial advice.
- Document type detection and metadata extraction are rule-based and best effort; correct them in the document details.
- One API worker by design; horizontal scaling would need shared storage for rate limits, jobs and vectors.
