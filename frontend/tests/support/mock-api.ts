import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page, Route } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const PDF = readFileSync(path.join(__dirname, "../fixtures/sample-lease.pdf"));

export const LEASE = "DOC-1A2B3C4D";
export const POLICY = "DOC-9F8E7D6C";

export function doc(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    filename: `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
    title,
    page_count: 3,
    chunk_count: 6,
    size_bytes: 24_000,
    uploaded_at: "2026-10-01T09:00:00+00:00",
    doc_type: "contract",
    type_confidence: 0.75,
    type_signals: ["this agreement", "the parties", "termination"],
    issuer: null,
    doc_date: null,
    reference: null,
    supersedes: [],
    edited: [],
    ocr_pages: 0,
    summary: "A **sample lease** used by the automated tests.",
    example_questions: ["When is the deposit refunded?", "Are pets allowed?"],
    status: "active",
    superseded_by: null,
    ...extra,
  };
}

export const DEPOSIT_SOURCE = {
  circular_id: LEASE,
  title: "Sample lease",
  clause_id: "2. Deposit",
  page: 2,
  status: "active",
  origin: "upload",
  versioned: false,
  doc_type: "contract",
  text: "The security deposit is refundable within 30 days of vacating the premises. Deductions require an itemised statement.",
  date: "2026-10-01",
};

export const sse = (events: unknown[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

export const ANSWER_EVENTS = [
  { type: "stage", name: "understanding" },
  { type: "stage", name: "searching" },
  { type: "plan", mode: "single", reason: "", documents: [{ id: LEASE, title: "Sample lease", label: null, passages: 1 }], contributing: [LEASE], retrieval: { mode: "hybrid", rerank: true, rewritten: null } },
  { type: "stage", name: "reranking" },
  { type: "sources", items: [DEPOSIT_SOURCE] },
  { type: "stage", name: "drafting" },
  { type: "token", text: "The security deposit is refundable within 30 days of vacating the premises " },
  { type: "token", text: `[${LEASE}, p. 2]. Deductions need an itemised statement [${LEASE}, p. 3].` },
  {
    type: "done",
    refused: false,
    usage: { latency_ms: 1840, passages_checked: 1, passages_used: 1, model: "ollama:qwen3:1.7b", citations_resolved: 1, citations_total: 2 },
    citations: [
      { doc_id: LEASE, page: 2, status: "supported", coverage: 0.86, claim: "The security deposit is refundable within 30 days of vacating the premises", evidence: "The security deposit is refundable within 30 days of vacating the premises." },
      { doc_id: LEASE, page: 3, status: "unsupported", coverage: 0.2, claim: "Deductions need an itemised statement", evidence: "No pets are allowed without written consent." },
    ],
  },
];

type Options = { documents?: unknown[]; stream?: string | ((body: Record<string, unknown>) => string); authEnabled?: boolean };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

/** Stubs every API endpoint the workspace uses. Requests are recorded for assertions. */
export async function mockApi(page: Page, options: Options = {}) {
  const documents = [...(options.documents ?? [doc(LEASE, "Sample lease")])];
  const chats: { id: string; title: string; created_at: string; updated_at: string; message_count: number; messages: Record<string, unknown>[] }[] = [];
  const asked: Record<string, unknown>[] = [];

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const p = url.pathname;
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (p === "/auth/config") return json(route, { auth_enabled: options.authEnabled ?? false });
    if (p === "/auth/login" || p === "/auth/register") {
      const body = req.postDataJSON() as { email: string; password: string };
      if (body.password !== "correct horse battery") return json(route, { detail: "Email or password is wrong." }, 401);
      return json(route, { token: "signed-token", email: body.email });
    }
    if (options.authEnabled && req.headers().authorization !== "Bearer signed-token") return json(route, { detail: "Sign in to use your documents." }, 401);
    if (p === "/llm/providers")
      return json(route, {
        default: "ollama",
        providers: [
          { id: "ollama", label: "Local (Ollama)", model: "qwen3:1.7b", available: true, reason: null, local: true },
          { id: "openrouter", label: "OpenRouter", model: "nvidia/nemotron-3-super-120b-a12b:free", available: false, reason: "Set OPENROUTER_API_KEY on the server to enable.", local: false },
          { id: "mistral", label: "Mistral", model: "mistral-small-latest", available: false, reason: "Set MISTRAL_API_KEY on the server to enable.", local: false },
          { id: "groq", label: "Groq", model: "qwen/qwen3.8-27b", available: false, reason: "Set GROQ_API_KEY on the server to enable.", local: false },
          { id: "gemini", label: "Gemini (Google)", model: "gemini-3.1-pro", available: false, reason: "Set GEMINI_API_KEY on the server to enable.", local: false },
        ],
      });
    if (p === "/documents" && method === "GET") return json(route, documents);
    if (p === "/documents" && method === "POST") return json(route, { id: "job_1", filename: "new.pdf", status: "queued", stage: "Waiting to start" }, 202);
    if (p === "/documents/jobs/job_1") {
      const created = doc("DOC-0000ABCD", "Uploaded policy", { doc_type: "manual" });
      if (!documents.some((d) => (d as { id: string }).id === created.id)) documents.unshift(created);
      return json(route, { id: "job_1", filename: "new.pdf", status: "done", stage: "Ready", document: created });
    }
    const docMatch = p.match(/^\/documents\/(DOC-[0-9A-F]+)(\/file)?$/);
    if (docMatch && docMatch[2]) return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/pdf" }, body: PDF });
    if (docMatch && method === "PATCH") {
      const i = documents.findIndex((d) => (d as { id: string }).id === docMatch[1]);
      const patch = req.postDataJSON() as Record<string, unknown>;
      documents[i] = { ...(documents[i] as object), ...patch, edited: Object.keys(patch) };
      return json(route, documents[i]);
    }
    if (docMatch && method === "DELETE") {
      documents.splice(documents.findIndex((d) => (d as { id: string }).id === docMatch[1]), 1);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (p === "/chats" && method === "GET") return json(route, chats.map((c) => ({ ...c, messages: [] })));
    if (p === "/chats" && method === "POST") {
      const chat = { id: `chat_${chats.length + 1}`, title: "New chat", created_at: "2026-10-09T10:00:00+00:00", updated_at: "2026-10-09T10:00:00+00:00", message_count: 0, messages: [] };
      chats.unshift(chat);
      return json(route, chat, 201);
    }
    const chatMatch = p.match(/^\/chats\/(chat_\d+)(\/messages)?$/);
    if (chatMatch) {
      const chat = chats.find((c) => c.id === chatMatch[1]);
      if (!chat) return json(route, { detail: "Chat not found." }, 404);
      if (chatMatch[2]) {
        const body = req.postDataJSON() as Record<string, unknown>;
        const message = { id: `msg_${chat.messages.length + 1}_${chat.id}`, ...body, created_at: "2026-10-09T10:00:01+00:00" };
        chat.messages.push(message);
        chat.message_count = chat.messages.length;
        if (chat.title === "New chat") chat.title = String(body.question);
        return json(route, message, 201);
      }
      if (method === "DELETE") {
        chats.splice(chats.indexOf(chat), 1);
        return route.fulfill({ status: 204, headers: CORS });
      }
      return json(route, chat);
    }
    if (p === "/ask/stream") {
      const body = req.postDataJSON() as Record<string, unknown>;
      asked.push(body);
      const stream = typeof options.stream === "function" ? options.stream(body) : (options.stream ?? sse(ANSWER_EVENTS));
      return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "text/event-stream" }, body: stream });
    }
    return json(route, { detail: `Unmocked ${method} ${p}` }, 404);
  });

  return { asked, documents, chats };
}
