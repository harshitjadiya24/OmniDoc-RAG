# Architecture

Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, zustand, zod 4, motion, Radix primitives, cmdk, pdf.js.

## Routes

| Route | Rendering | Notes |
|---|---|---|
| `/` (`app/(site)`) | Static, server components with client islands | Product site. Every demo is scripted and labelled; nothing is presented as a real result |
| `/app` | Static shell, client workspace | `WorkspaceGate` checks `/auth/config`: API unreachable screen, sign-in, or the workspace |
| `/opengraph-image` | Static | Social preview |

## API layer (`src/lib/api`)

All responses and SSE events are validated with zod (`schemas.ts`). Only the current backend contract is modelled.

| Module | Endpoints |
|---|---|
| `documents.ts` | `GET/POST /documents`, `GET /documents/jobs/{id}` (polled every 800 ms), `PATCH/DELETE /documents/{id}`, `/documents/{id}/file` |
| `chats.ts` | `GET/POST /chats`, `GET/DELETE /chats/{id}`, `POST /chats/{id}/messages` |
| `auth.ts` | `/auth/config`, `/auth/login`, `/auth/register`, `/llm/providers` |
| `stream.ts` | `POST /ask/stream` (SSE via `@microsoft/fetch-event-source`) |
| `client.ts` | Shared fetch: bearer token, FastAPI `detail` parsing, a 401 clears the session |

`stream.ts` rules: malformed or unknown events are dropped (debug-logged in development); at most two retries, only before the first event; a close without `done`/`error` is an early close that keeps the partial answer; 60 s of silence stops the stream; an `error` event carries the provider's reason.

## State (`src/stores`)

| Store | Holds |
|---|---|
| `conversation` | The live turn as a state machine: `idle → submitting → streaming → complete / refused / error / aborted`. Stages only move forward; unknown, repeated or out-of-order stage events never move the stepper back. On `done` it attaches page checks to chips and saves the turn to the chat |
| `library` | Documents, selection, Ask/Compare task, upload jobs, the open details drawer. `askBlocker()` explains why a question can't be sent |
| `chats` | Saved chats and the open chat's transcript. Saving is best effort and never breaks an answer |
| `evidence` | Which turn the evidence pane shows, the selected passage, chip hover, the PDF target, the mobile sheet |
| `settings` | Retrieval mode, rerank, rewrite, model. Persisted; stale or corrupt values fall back to defaults |
| `ui`, `actions.ts` | Library sheet; cross-store actions (new chat, open chat, focus composer) |

## Citations and checks (`src/lib/rag`)

- `citations.ts` parses `[DOC-1A2B3C4D, p. 7]` (groups separated by `;`) with a linear regex. Mistyped IDs (`DOC-` plus 4 to 12 characters) are still parsed so they render as **Unverified citation** instead of slipping through as text. A citation resolves only when its document and page were among the returned passages.
- `checks.ts` pairs each backend `CitationCheck` with its chip by document page and occurrence, so a skipped citation can't shift every later verdict.
- `coverage.ts` is a port of `backend/src/docqa/verify.py` (same stopwords, tokenizer, 0.70 / 0.40 thresholds) used only by the landing page's interactive explainer. `tests/coverage.test.ts` pins it to values cross-checked against the Python.
- `pdf-highlight.ts` maps pdf.js text runs onto the passage to draw highlight boxes.

## Rendering the answer

`AnswerText` splits the answer into markdown blocks (outside code fences) and memoizes finished ones, so only the last block re-renders while streaming. A remark plugin turns citation brackets into `<cite-chip>` nodes numbered globally across blocks. `useFrameSelector` limits streaming re-renders to one per animation frame. Markdown has no raw HTML, http(s) links only, and wide tables scroll in their own labelled region.

## Layout

From 1280 px: three panes (library, conversation, evidence), each its own scroll region with `overscroll-behavior: contain`. From 1024 px the library becomes a sheet; below that the evidence does too. The composer is docked under the conversation. Headers publish `--header-h` for sticky offsets.

## Tests

| Suite | Covers |
|---|---|
| `tests/*.test.ts` (vitest) | Citation parsing and resolution, check assignment, the conversation state machine against real SSE bodies (success, refusal, early close, model error, HTTP detail, wrong content type, guards), upload polling, settings sanitising, the document form, the coverage port |
| `workspace.spec.ts` | Answer with verdict chips and evidence, chip popover to rendered PDF page, refusal, early close, model failure, compare A/B, upload, editing details, phone sheets |
| `chats-accounts.spec.ts` | Saving and reopening chats, sign-in gate and bearer token, API unreachable screen, command palette |
| `landing.spec.ts` | axe in both themes, demo labels, the verification explainer, reduced motion, navigation, mobile menu |
| `smoke.spec.ts`, `layout-integrity.spec.ts` | One h1, axe, clean console, 404, theme toggle, skip link; no sideways scroll at 320 to 2560 px and 200% zoom, including an answered workspace and every scroll region |
