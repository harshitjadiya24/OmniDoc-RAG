import { beforeEach, describe, expect, it } from "vitest";
import { installBrowserGlobals, jsonResponse, mockFetch, sse, streamResponse } from "./support/sse";

installBrowserGlobals();

const { advanceStages, finishStages, useConversation } = await import("@/stores/conversation");
const { useLibrary } = await import("@/stores/library");
const { useChats } = await import("@/stores/chats");

const DOC = "DOC-1A2B3C4D";
const SOURCE = { circular_id: DOC, title: "Lease", clause_id: "4. Rent", page: 2, status: "active", origin: "upload", text: "Rent is due monthly.", date: "2026-01-01" };
const chatRoutes = {
  "POST /chats": () => jsonResponse({ id: "chat_1", title: "New chat", created_at: "t", updated_at: "t", message_count: 0, messages: [] }, 201),
  "POST /chats/chat_1/messages": (init?: RequestInit) =>
    jsonResponse({ id: "msg_1", ...JSON.parse(String(init?.body)), created_at: "t" }, 201),
  "GET /chats": () => jsonResponse([]),
};

beforeEach(() => {
  useConversation.getState().clear();
  useChats.setState({ activeId: null, transcript: [], chats: [] });
  useLibrary.setState({ documents: [{ id: DOC } as never], selectedIds: [DOC], task: "ask" });
});

describe("stage ordering", () => {
  it("only moves forward", () => {
    let s = useConversation.getState().stages;
    s = advanceStages(s, "reranking", 1);
    expect(s.map((x) => x.status)).toEqual(["done", "done", "active", "pending"]);
    s = advanceStages(s, "searching", 2);
    expect(s.map((x) => x.status)).toEqual(["done", "done", "active", "pending"]);
    expect(advanceStages(s, "checking_versions", 3)).toBe(s);
  });
  it("finishes every stage on done", () => {
    expect(finishStages(useConversation.getState().stages, 5).every((x) => x.status === "done" && x.endedAt === 5)).toBe(true);
  });
});

describe("a full answer", () => {
  it("streams stages, plan, sources and tokens, then attaches checks and saves the turn", async () => {
    const fetch = mockFetch({
      ...chatRoutes,
      "POST /ask/stream": () =>
        streamResponse(
          sse([
            { type: "stage", name: "understanding" },
            { type: "stage", name: "searching" },
            { type: "plan", mode: "single", reason: "", documents: [{ id: DOC, title: "Lease", label: null, passages: 1 }], contributing: [DOC] },
            { type: "sources", items: [SOURCE] },
            { type: "bogus", nope: true },
            { type: "token", text: "Rent is due monthly " },
            { type: "token", text: `[${DOC}, p. 2].` },
            {
              type: "done",
              refused: false,
              usage: { latency_ms: 812, citations_resolved: 1, citations_total: 1 },
              citations: [{ doc_id: DOC, page: 2, status: "supported", coverage: 1, claim: "Rent is due monthly", evidence: "Rent is due monthly." }],
            },
          ]),
        ),
    });
    await useConversation.getState().submit("When is rent due?");
    const s = useConversation.getState();
    expect(s.phase).toBe("complete");
    expect(s.answer).toBe(`Rent is due monthly [${DOC}, p. 2].`);
    expect(s.chunks).toBe(2);
    expect(s.stages.every((x) => x.status === "done")).toBe(true);
    expect(s.checkByChip["0:0"].status).toBe("supported");
    const body = JSON.parse(String(fetch.mock.calls.find(([u]) => String(u).endsWith("/ask/stream"))?.[1]?.body));
    expect(body).toMatchObject({ question: "When is rent due?", document_ids: [DOC], task: "ask", mode: "hybrid", chat_id: null });
    await expect.poll(() => useConversation.getState().savedId).toBe("msg_1");
  });

  it("reports a refusal with the backend's copy", async () => {
    mockFetch({
      ...chatRoutes,
      "POST /ask/stream": () =>
        streamResponse(sse([{ type: "done", refused: true, usage: { latency_ms: 5 }, refusal: { title: "Not found", message: "Nothing answers this.", suggestions: [] } }])),
    });
    await useConversation.getState().submit("What is the capital of France?");
    expect(useConversation.getState().phase).toBe("refused");
    expect(useConversation.getState().refusal?.title).toBe("Not found");
  });
});

describe("failures keep what arrived", () => {
  it("treats a close without done as an early close", async () => {
    mockFetch({ ...chatRoutes, "POST /ask/stream": () => streamResponse(sse([{ type: "token", text: "Partial answer" }])) });
    await useConversation.getState().submit("When is rent due?");
    const s = useConversation.getState();
    expect(s.phase).toBe("error");
    expect(s.error?.kind).toBe("early_close");
    expect(s.answer).toBe("Partial answer");
  });

  it("shows the model's own error message", async () => {
    mockFetch({ ...chatRoutes, "POST /ask/stream": () => streamResponse(sse([{ type: "token", text: "A" }, { type: "error", message: "The answer model could not respond: quota" }])) });
    await useConversation.getState().submit("When is rent due?");
    expect(useConversation.getState().error).toEqual({ message: "The answer model could not respond: quota", kind: "model" });
  });

  it("uses the HTTP detail for a rejected request", async () => {
    mockFetch({ ...chatRoutes, "POST /ask/stream": () => jsonResponse({ detail: "Compare needs exactly two documents." }, 422) });
    await useConversation.getState().submit("Compare these");
    expect(useConversation.getState().error).toMatchObject({ kind: "http", message: "Compare needs exactly two documents." });
  });

  it("rejects a response that is not an event stream", async () => {
    mockFetch({ ...chatRoutes, "POST /ask/stream": () => streamResponse("<html>", { contentType: "text/html" }) });
    await useConversation.getState().submit("When is rent due?");
    expect(useConversation.getState().error?.kind).toBe("content_type");
  });
});

describe("guards", () => {
  it("does not send without a selected document", async () => {
    const fetch = mockFetch({});
    useLibrary.setState({ selectedIds: [] });
    await useConversation.getState().submit("When is rent due?");
    expect(fetch).not.toHaveBeenCalled();
    expect(useConversation.getState().phase).toBe("idle");
  });

  it("does not send compare without exactly two documents", async () => {
    const fetch = mockFetch({});
    useLibrary.setState({ task: "compare" });
    await useConversation.getState().submit("Compare them");
    expect(fetch).not.toHaveBeenCalled();
  });
});
