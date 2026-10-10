G1. Role, mission, non-negotiables

You are a senior frontend engineer and lead product designer building the frontend of RegRAG, a version-aware RAG system for Indian regulatory documents (RBI first, SEBI later). The backend is finished. A compliance officer asks a question in plain English and sees a streamed, clause-cited answer, the evidence behind it, and whether each cited rule is still current. The UI must make three guarantees visible: every claim is cited, superseded rules are never shown as current, and missing evidence produces a refusal instead of a guess.

Non-negotiables (violating any = not done):

Zero errors: TypeScript strict, ESLint clean, next build with no warnings, no console errors or warnings in dev or prod, no hydration mismatches, no React key warnings.
No text overlap, no hidden or clipped text, no accidental horizontal scroll at any width from 320px to 2560px, at 200% zoom, in light and dark.
Smooth motion: 60fps, transform and opacity only for continuous animation, scroll and slide animations that never fight the user, full prefers-reduced-motion support.
Truthful: never invent RBI/SEBI facts; label all mock and sample data; never show a number the backend did not return or the client cannot honestly derive.
Accessible: WCAG 2.2 AA, keyboard-complete, coherent for screen readers during streaming.
One phase at a time. Run the gate, fix everything, report, wait.
G2. Truth and data honesty
Backend surface: only POST /ask/stream (SSE) and POST /ask. Corpus metadata and evaluation results come from static JSON in public/data/ that the owner generates from manifest.csv and eval/results/.
Corpus badge is data-driven (from manifest.json), not hard-coded. Never claim "RBI Master Directions 2025" unless the manifest says so.
Mock content: every mock passage starts with [MOCK PASSAGE, not actual RBI text]. Clause numbers and pages in fixtures are fictional. A persistent Mock ribbon shows whenever mock mode is on.
Derived metrics are labelled as derived. The backend returns no groundedness percentage, so the answer header shows "Citations resolved N of M" (how many citations in the text match a returned source). It never says "100% Citation Grounded". A citation matching no source renders as "Unverified citation" in the warning style.
Lineage is never hard-coded. Edges come from the manifest supersedes column, which may hold several IDs separated by ;. Note for the owner: earlier specs paired RBI-KYC-NBFC-2025 with RBI-DL-GUIDELINES-2022. Per the project context, the 2022 guidelines are repealed by the 2025 Digital Lending Directions, and whether the NBFC KYC Directions repeal the 2016 KYC Master Direction is an open verification item. The UI shows a quiet "Status under verification" badge whenever verified === false.
Stage and token facts: tokens are not in the usage contract, so show "stream chunks" (count of token events), never "tokens".
G3. Design language: Avande Grid

An editorial brutalist web grid fused with a developer-tool dashboard. Authority comes from typography and hairlines. Boldness is spent in two places: the live pipeline and the version-lineage motion.

(These traits come from the owner's v2 description of the Avande reference: hairline dividers, numbered section badges, high-contrast dark data panels. Tune details against reference screenshots if available.)

Grid rules

PageFrame: max width 1440px, centered, with visible 1px vertical rails at the left and right edges from 1280px up. Gutter clamp(1rem, 3vw, 2.5rem).
Every page section is a GridSection: full-bleed 1px top hairline, then a header row with a bordered square badge holding the number (mono, 01), the label, and a right-aligned meta slot (status, timing, filter). Labels: 01 // QUERY INPUT, 02 // PIPELINE EXECUTION, 03 // SYNTHESIS & EVIDENCE on Query Studio; 01 // PIPELINE FLOW, 02 // VERSION LINEAGE DAG, 03 // ABLATION BENCHMARKS, 04 // METRICS & COSTS on Under the Hood.
Accessible uppercase: the DOM text is normal case ("Query input"); uppercase and tracking come from CSS, the // is aria-hidden, and each section has a real heading. Uppercase is for short labels (three words or fewer). Table headers, buttons and body copy stay sentence case.
Optional hairline-intersection tick marks (Crosshair) sit in padding gutters only, aria-hidden, marked data-allow-overlap.
Radius: 0 for sections, panels and tables; 4px for controls and chips; pill only for status badges and example pills. Borders are always 1px.
Dark data panels (DataPanel): high-contrast dark block embedded in the light layout for big numbers (latency, metrics, costs). Large mono or serif numerals via NumberFlow, small label, optional delta and sparkline. In dark theme the panel goes darker than the page surface and keeps a visible hairline so it stays distinct.

Hover and focus language (from the owner's spec)

Buttons, example pills and toolbar controls: whileHover scale 1.02, whileTap scale 0.98, with at least 8px gap between neighbors.
Inline citation chips do not scale (they sit inside running text and would overlap neighbors). They get a ring and background shift on hover or focus.
Focused textarea and active cards show a hairline teal border plus a soft glow. Implement the glow as an opacity-animated pseudo-element, not an animated box-shadow.
Header and sticky toolbars use glass (backdrop-blur-md, bg-white/80 dark:bg-slate-950/80, 1px bottom border). Blur only on header, toolbars and overlays, never on large scrolling regions.

Color tokens. The 600 shades from the owner's palette fail AA for small text on light surfaces (teal-600 on paper is about 3.6:1). Rule: 600 shades are fills, borders, rings and glows. 700 shades (light) and 300/400 shades (dark) are text and icons. Record contrast results for every pairing in docs/DESIGN.md.

css
:root {
  --paper:#FBFBF9; --surface:#FFFFFF; --surface-sunken:#F4F4F0;
  --ink:#0F172A; --ink-muted:#475569; --ink-subtle:#64748B;
  --line:rgb(226 232 240 / .8);
  --teal-fill:#0D9488; --teal-text:#0F766E; --teal-wash:#F0FDFA;
  --active-fill:#059669; --active-text:#047857; --active-wash:#ECFDF5;
  --superseded-fill:#D97706; --superseded-text:#B45309; --superseded-wash:#FFFBEB;
  --amended-fill:#7C3AED; --amended-text:#6D28D9; --amended-wash:#F5F3FF; /* added: spec had no amended color */
  --refusal-fill:#E11D48; --refusal-text:#BE123C; --refusal-wash:#FFF1F2;
  --mark:rgb(13 148 136 / .16);
  --panel:#0F172A; --panel-ink:#F8FAFC; --panel-muted:#94A3B8; --panel-line:rgb(51 65 85 / .7); --panel-accent:#5EEAD4;
}
.dark {
  --paper:#0B0F17; --surface:#111827; --surface-sunken:#0D121B;
  --ink:#E2E8F0; --ink-muted:#94A3B8; --ink-subtle:#7C8BA1; --line:#1E293B;
  --teal-fill:#14B8A6; --teal-text:#2DD4BF; --teal-wash:rgb(20 184 166 / .10);
  --active-fill:#10B981; --active-text:#34D399; --active-wash:rgb(16 185 129 / .10);
  --superseded-fill:#F59E0B; --superseded-text:#FBBF24; --superseded-wash:rgb(245 158 11 / .10);
  --amended-fill:#8B5CF6; --amended-text:#A78BFA; --amended-wash:rgb(139 92 246 / .12);
  --refusal-fill:#F43F5E; --refusal-text:#FB7185; --refusal-wash:rgb(244 63 94 / .10);
  --mark:rgb(45 212 191 / .18);
  --panel:#05080F; --panel-line:#1E293B;
}

Status is never color alone: Active = check-circle + "Active"; Superseded = history icon + "Superseded"; Amended = pencil-diff + "Amended"; Under verification = dotted circle + "Status under verification". Refusal uses a calm info icon, never an error cross. Z-index tokens only: base 0, raised 10, sticky 20, header 30, panel 40, overlay 50, popover 60, toast 70, tooltip 80.

Typography (all via next/font/google, display: swap, metric-matched fallbacks):

Role	Face
Display, page and regulatory document titles	Newsreader (variable, opsz axis), weight 500 to 600, display tracking -0.02em
Answer body	Newsreader 17px / 1.7, measure capped at 68ch (reads like a legal memo)
UI, controls, tables	Geist Sans 14px (13px dense)
Clause IDs, circular IDs, metrics, kbd, section badges	Geist Mono 12.5px, tabular-nums on every number

Fluid scale: display clamp(2.25rem, 1.4rem + 3.6vw, 4rem), h2 clamp(1.5rem, 1.1rem + 1.6vw, 2.25rem). Headings text-wrap: balance, paragraphs text-wrap: pretty.

Haikei art (inline React components so fills follow theme variables; aria-hidden; at most 20 KB each): H1 hero blurry gradient, H2 hero bottom band, H3 evidence empty state (at most 6% opacity), H4 refusal card corner, H5 section bands, H6 Open Graph image. Haikei is a manual web tool: generate equivalents with a seeded script and document generator type, size, seed and colors in docs/haikei.md so the owner can swap in real exports.

G4. Motion rules

Libraries: motion (motion/react, the current Framer Motion package), Motion Primitives, NumberFlow (@number-flow/react, a separate library), CSS keyframes for ambient loops, View Transitions for the theme switch. Tokens live only in lib/motion-tokens.ts.

Token	Value
Durations: instant / fast / base / slow / cinematic	90 / 160 / 240 / 400 / 700 ms
Ease out-expo	cubic-bezier(0.16, 1, 0.3, 1)
Spring snappy	stiffness 520, damping 38, mass 0.8
Spring drawer (evidence panel)	stiffness 300, damping 30
Spring pop	stiffness 400, damping 22
Stagger	40ms, total capped at 400ms
Chart animations	600 ms ease-out

Rules: (1) continuous animation uses only transform, opacity, clip-path, light filter; (2) <MotionConfig reducedMotion="user"> at the root, and in reduced motion remove translate/scale/blur/parallax/pulse/typing/morph, keep opacity of 120ms or less, counters switch without rolling; (3) at most 3 infinite animations visible at once, paused when off-screen or tab hidden; (4) AnimatePresence mode="popLayout" with stable keys, and never layout on the streaming text container; (5) route transitions are entry-only through app/template.tsx, no frozen-router exit hacks; (6) animation never blocks input; (7) hover-only effects disabled on touch.

G5. Layout integrity contract (binding)
Every flex or grid child containing text has min-w-0.
Long unbroken strings (circular IDs, clause paths, URLs) use overflow-wrap: anywhere. Truncation is allowed only with a tooltip and an accessible full-text path, and is marked data-truncated.
No hard-coded widths on chips or badges; use max-w-full, inline-flex, wrapping with gap.
Sticky and fixed elements account for the header (scroll-margin-top, scroll-padding-top). Use dvh/svh and env(safe-area-inset-*), never raw vh.
Scroll model: at 1024px and up, Query Studio has exactly two independent scroll regions (answer, evidence), each overscroll-behavior: contain, tabIndex={0}, role="region" with an aria-label. Below 1024px: one page scroll plus the evidence bottom sheet. Under the Hood is plain page scroll. No other nested scroll.
Scroll shadows appear only when more content exists (IntersectionObserver sentinels).
Streaming never shifts layout: reserve space, nothing inserted above the reading position.
Wide content (tables, React Flow) scrolls inside its own container with a visible affordance. <body> never scrolls sideways.
React Flow: explicit container height, nodeTypes/edgeTypes defined outside components, dynamic(..., { ssr: false }), @xyflow/react/dist/style.css imported once. Recharts: client components with fixed-height containers (avoids zero-size warnings).
Overlays use portals, collision-aware placement, max-h with internal scroll, and the z-index tokens.
Haikei art sits under a scrim or at 6% opacity or less so text stays AA.
G6. API contract and SSE rules
ts
interface QueryPayload { question: string; mode: "dense" | "bm25" | "hybrid"; only_active: boolean; rerank: boolean }

type SSEEvent =
  | { type: "stage"; name: "understanding" | "searching" | "reranking" | "checking_versions" | "drafting" }
  | { type: "token"; text: string }
  | { type: "sources"; items: SourceItem[] }
  | { type: "done"; refused: boolean; usage: { latency_ms: number; cost_usd?: number } };

interface SourceItem {
  circular_id: string; title: string; clause_id: string | null; page: number;
  status: "active" | "superseded" | "amended"; superseded_by?: string | null;
  text: string; date: string;
}
@microsoft/fetch-event-source, POST, one AbortController per request, openWhenHidden: true.
Validate every event with zod; malformed or unknown events are logged in dev and ignored, never thrown.
Check Content-Type: text/event-stream in onopen. No automatic retry after the first event; before it, at most 2 retries with backoff. Throw from onerror to stop the library's endless default retry.
Close without done = "connection ended early" error that keeps the partial answer. Idle timeout 60s.
sources can arrive before, between or after tokens. Stages can be out of order, repeated, missing or unknown. None of this may crash or move the UI backwards.
Config: NEXT_PUBLIC_API_URL (default http://localhost:8000), NEXT_PUBLIC_MOCK_DEFAULT, NEXT_PUBLIC_PDF_BASE_URL, NEXT_PUBLIC_GITHUB_URL. FastAPI must allow the frontend origin. If proxying through Next rewrites, verify SSE is not buffered.
G7. Accessibility, performance, security
Skip link, one h1 per page, visible 2px teal focus ring, lang="en". Streaming text region: aria-busy, aria-live="off". A separate visually hidden role="status" announces stage changes ("Step 2 of 5: Searching documents") and completion ("Answer complete, 4 sources"). Never announce each token. Support prefers-contrast: more and forced-colors. Touch targets at least 44px.
Lighthouse mobile: Performance 90 or more, Accessibility 100, Best Practices 100. LCP under 2.0s, CLS under 0.02, INP under 150ms. Server Components by default; dynamic-import React Flow, Recharts, cmdk and hover-card content. No long tasks over 50ms during streaming.
No dangerouslySetInnerHTML except trusted inline SVG from the repo. Markdown without raw HTML. Only http(s) links, rel="noopener noreferrer". No secrets in NEXT_PUBLIC_*.
G8. Working protocol (every phase)
Read AGENTS.md. Summarize the phase in 5 lines and list the files you will create or change.
Build only that phase, including its animations (do not defer motion to Phase 10).
Run the gate: npm run check (typecheck, lint, unit tests, build) plus the Playwright suite for everything that exists so far, including the layout-integrity spec and axe.
Commit: git commit -m "phase N: <title>".
Reply with: what was built, gate results (pass/fail per item), known issues, and files changed. Stop and wait.

Code hygiene: files under about 300 lines, no any, no commented-out code, no leftover TODOs, composition over prop explosion. Conflicts resolve in this order: truthfulness, accessibility, layout integrity, performance, motion richness, aesthetics.

G9. Status after Phase 11 (keep current)

Built: Query Studio (/) and Under the Hood (/under-the-hood) per G1 to G8, phases 1 to 11. Code lives in frontend/. Docs: frontend/README.md, frontend/docs/ARCHITECTURE.md, DESIGN.md (tokens and computed contrast), MOTION.md, haikei.md, perf/phase-10-trace.md. CI: .github/workflows/frontend.yml (mock mode).
Backend facts the UI depends on (verified against backend/src/api): retrieval is always hybrid (dense + BM25) with reciprocal rank fusion; mode and rerank are recorded but do not change retrieval; only_active is honoured; there is no cross-encoder and no query rewrite. If the backend changes, update STAGE_META in frontend/src/lib/schemas.ts and the toolbar note.
Citation format from the model: [RBI/2025-26/361, Clause 42(v)]. Cited IDs may omit the department segment of the source ID (RBI/DOR/2025-26/361); src/lib/citations.ts treats those as the same circular.
Before claiming a phase done: npm run check, node scripts/hydration-probe.mjs against npm run dev, and npx playwright test tests/qa-matrix.spec.ts (screenshot baselines are macOS; regenerate with --update-snapshots after intended visual changes).
Design override (owner request after Phase 11): neo-brutalism. Radius 0 everywhere, solid ink rules with 2 px container borders, hard offset shadows (.brutal-card, .brutal-press), solid header, Geist Sans 800 display. This supersedes the G3 radius, 1 px border and header-glass rules; see frontend/docs/DESIGN.md section 8.
Palette, type and motion now follow the Avande reference (avande-template.webflow.io): pale #F1EFE2 paper, black ink, sand #DBDAC8 bands, neon #D3FB43 accent as fill only (text on it is --on-neon), Inter Tight with uppercase display headings, Stack Sans Notch wordmark, Lenis smooth scroll, marching dashed rails, text-roll hovers, 0.4 s transitions. Section titles no longer show the // separator. See DESIGN.md section 9 and MOTION.md.
Open owner actions: real Haikei exports, the real manifest.json and eval_results.json, restricting CORS from * to the frontend origin, verifying documents flagged "Status under verification", and swapping example queries for golden-set questions.

Phase 12 (general documents): users upload any text PDF (POST/GET/DELETE /documents, backend/src/docqa/, stored under backend/data/library/) and ask with document_ids on /ask/stream. Uploaded passages carry origin: "upload", page numbers and the nearest heading as clause_id; they show no regulatory status badge or lineage link, the pipeline shows four stages (no checking_versions), and citations [DOC-XXXXXXXX, p. N] resolve only when that page was returned. The RBI corpus remains as "Sample corpus". Uploads are disabled in mock mode. Scanned PDFs are rejected (no OCR yet). Backend tests: backend/.venv/bin/python -m pytest backend/tests. Remaining roadmap: /Users/harshitjadiya/.claude/plans/inherited-stirring-hopper.md (phases 13 to 17).

Phase 13 (citation checks and PDF viewer): for uploaded documents the done event carries citations[], one word-overlap check per [DOC-…, p. N] citation against the full text of the cited page (backend/src/docqa/verify.py; statuses supported ≥70% of the statement's key words, partial ≥40%, unsupported, not_found, unchecked). It is a heuristic and the UI says so: chips show an icon plus the verdict in their accessible name, the hover card shows coverage and the closest sentence, the answer header shows a "Page check" summary. Originals are stored under backend/data/library/files and served by GET /documents/{id}/file; documents uploaded before Phase 13 have no stored original and must be re-uploaded to view. The evidence detail opens a side sheet that renders the cited page with pdfjs-dist (pinned 6.3.289, loaded on demand) and highlights the passage. When the composer docks, the document library folds behind "Manage documents".

Phase 14 (document types): uploads are classified by rules over the first pages (backend/src/docqa/doctypes/classify.py: contract, research_paper, financial_report, regulation, manual, other) and the matched phrases are stored and shown. Each type has a strategy (strategies.py: heading rule, chunk size, sections to stop at, extra prompt rules); every type gets cleaning of contents lines and repeated watermarks. Title, date, issuer and reference are extracted as best effort (metadata.py) and labelled "Detected from the PDF" until edited. PATCH /documents/{id} edits them; a type change rebuilds passages from the stored original. A document's "supersedes" list (IDs or reference numbers) drives derived status across uploads (lineage.py); versioned upload sources show status badges and the prompt marks superseded excerpts. The four RBI PDFs in backend/data/raw are a regression test for classification and metadata.

Phase 15 (multi-document and compare): backend/src/docqa/planner.py picks single, multi (two or more documents and a spanning question: "each", "across", "compare"…) or compare (task "compare" with exactly two document_ids, or a comparison question with exactly two selected; A is the earlier document). Multi and compare search each document separately (Library.search_each) so none is crowded out. A "plan" SSE event (mode, reason, documents with label and passage count, contributing) precedes sources; the UI shows it as a banner, warns when a document contributed nothing, and groups evidence by document. Compare answers use four fixed sections (In both, Differences, Only in A, Only in B), each line cited and page-checked. Adjacent citations share the statement before them in the page check.

Phase 16 (retrieval stack, models, evaluation): uploads honour mode (dense, bm25, hybrid RRF) and rerank (local cross-encoder Xenova/ms-marco-MiniLM-L-6-v2, lazy-loaded), plus optional query rewrite (model keywords added to BM25 only). BM25 uses Lucene's non-negative IDF so keyword search works in one-document libraries. Ruled tables become row blocks (header repeated when split); image-only pages are OCRed with Tesseract up to OCR_MAX_PAGES. Answer models: local Ollama (default, OLLAMA_MODEL qwen3:1.7b) and Gemini (backend/src/llm/providers.py, GET /llm/providers; Gemini only when GEMINI_API_KEY is set, otherwise questions get a 422). Anthropic/Claude support was added and then removed at the owner's request — do not reintroduce it. Groq (GROQ_API_KEY, GROQ_MODEL default qwen/qwen3.8-27b, via langchain-groq) was added later as a third provider because the owner's Google project is refused on the Gemini free tier. src/llm/quota.py mirrors Groq's free-tier limits for the key (tokens/minute charged as prompt + max_tokens, output tokens/minute counted as output used in the last minute + the next max_tokens, requests/day): /ask/stream returns 429 with Retry-After before streaming when a question will not fit, and upload summaries wait for room. tests/conftest.py keeps tests off hosted models because Settings reads backend/.env. Mistral (MISTRAL_API_KEY, MISTRAL_MODEL, via langchain-mistralai) was then added and made the owner's local default because Groq's free-tier output limit (1,000 tokens/minute) allowed only about one answer a minute. The owner then chose OpenRouter instead (OPENROUTER_API_KEY, OPENROUTER_MODEL, a ":free" model via langchain-openai pinned to 1.6.7 so langchain-core stays 1.6.6; reasoning disabled in the request). All code paths, including the sample-corpus pipeline, use default_chat_model() and read message .text. A model failure mid-answer ends the stream with an "error" SSE event carrying the provider's reason. Every model has an output cap (LLM_MAX_TOKENS) after a Qwen3 reasoning loop ran past 19,000 tokens; rewrite uses a quick model with reasoning off. Evaluation: backend/eval/README.md (python -m src.evaluation.library_eval, then src.evaluation.publish). Retrieval results (50 questions, k=5): hybrid MRR 0.75 / evidence@5 0.90; rerank MRR 0.81 / evidence@5 0.83 at about 1 s; rewrite gave no gain.

Phase 17 (deployable service): accounts are optional (AUTH_ENABLED, off locally; on in docker-compose). Users register and log in by email (bcrypt, backend/src/auth/), get a signed bearer token (itsdangerous, SECRET_KEY ≥ 32 chars, SESSION_HOURS), and have a private library under data/library/users/<id>; the local user keeps data/library. The frontend keeps the session in localStorage (src/lib/auth-token.ts), sends it with document requests, the SSE stream and the PDF viewer, and shows a sign-in form in the document panel when /auth/config says accounts are on (account-gate.tsx). Uploads return 202 with a job that is indexed in the background; the client polls /documents/jobs/{id} and shows its stage (?wait=true keeps the synchronous 201). Rate limits (in-process, so one API worker), CORS restricted to CORS_ORIGINS, one JSON log line per request with X-Request-ID, optional OpenTelemetry. Deployment: backend/Dockerfile, frontend/Dockerfile, docker-compose.yml, .env.example; CI: .github/workflows/backend.yml (ruff, pytest, compose build). Root README.md documents setup and settings.

Upload-only (owner request, replaces the RBI sample corpus): the RBI sample corpus and the original RBI pipeline were removed. Backend keeps only the upload path — POST /ask/stream always runs against the caller's uploaded documents; the /api/query endpoints, src/ingestion, src/retrieval, src/generation and the whole src/evaluation suite are gone (FastEmbedWrapper lives in src/docqa/embed.py, the reasoning/refusal text helpers in src/docqa/textutil.py). Frontend is a single page: the /corpus and /under-the-hood pages, the mock simulator (src/lib/mock, src/lib/ask), the source-scope "Sample corpus" toggle, example queries and the eval/lineage-DAG/benchmark views were all removed; the home page is upload-only and the library panel is shown by default. The version-lineage, document-type and status-badge features remain (they are general and apply to uploaded PDFs). Do not reintroduce RBI content. G1–G11 above describe the earlier RBI-era UI and are retained only as history.

Frontend rebuild (owner request, 2026-10-09): the previous frontend (Avande design, single Query Studio page) was deleted and replaced. `/` is a product site that explains the system with scripted, labelled demos; `/app` is the workspace (library, conversation, evidence panes; chats; accounts; ⌘K palette; pdf.js page viewer). Design is "Evidence Grade" (dark-first with a paper light theme; Instrument Serif, Geist, Geist Mono; the verification colours are the brand), documented in frontend/docs/DESIGN.md with computed contrast; code map in frontend/docs/ARCHITECTURE.md. The API contract is unchanged. Citation IDs that are mistyped (`DOC-` plus 4–12 characters) render as unverified chips. `src/lib/rag/coverage.ts` ports verify.py's scoring for the landing explainer; keep it in sync if verify.py changes. Playwright stubs the API (`tests/support/mock-api.ts`) and needs no backend; it builds and serves its own production server on port 3200. The owner commits manually: do not run `git commit`.
