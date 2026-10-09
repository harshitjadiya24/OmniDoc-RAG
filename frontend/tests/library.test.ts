import { afterEach, describe, expect, it, vi } from "vitest";
import { installBrowserGlobals, jsonResponse, mockFetch } from "./support/sse";

installBrowserGlobals();
const { useLibrary, askBlocker } = await import("@/stores/library");

const doc = (id: string) => ({
  id,
  filename: `${id}.pdf`,
  title: id,
  page_count: 3,
  chunk_count: 9,
  size_bytes: 1000,
  uploaded_at: "2026-10-09T00:00:00+00:00",
  doc_type: "contract",
});

afterEach(() => vi.useRealTimers());

describe("upload", () => {
  it("polls the job, reports each stage and adds the document selected", async () => {
    useLibrary.setState({ documents: [], selectedIds: [], uploads: [] });
    const stages: string[] = [];
    let polls = 0;
    mockFetch({
      "POST /documents": () => jsonResponse({ id: "job_1", status: "queued", stage: "Waiting to start" }, 202),
      "GET /documents/jobs/job_1": () =>
        jsonResponse(++polls < 2 ? { id: "job_1", status: "processing", stage: "Embedding 9 passages" } : { id: "job_1", status: "done", stage: "Ready", document: doc("DOC-AAAAAAAA") }),
    });
    const unsub = useLibrary.subscribe((s) => {
      const stage = s.uploads[0]?.stage;
      if (stage && stages.at(-1) !== stage) stages.push(stage);
    });
    await useLibrary.getState().upload([new File(["%PDF"], "lease.pdf", { type: "application/pdf" })]);
    unsub();
    expect(stages).toEqual(["Uploading", "Waiting to start", "Embedding 9 passages"]);
    expect(useLibrary.getState().documents.map((d) => d.id)).toEqual(["DOC-AAAAAAAA"]);
    expect(useLibrary.getState().selectedIds).toEqual(["DOC-AAAAAAAA"]);
    expect(useLibrary.getState().uploads).toEqual([]);
  });

  it("keeps a failed job visible with its reason", async () => {
    useLibrary.setState({ documents: [], selectedIds: [], uploads: [] });
    mockFetch({ "POST /documents": () => jsonResponse({ id: "job_2", status: "failed", stage: "Failed", error: "The PDF is password protected." }, 202) });
    await useLibrary.getState().upload([new File(["%PDF"], "locked.pdf", { type: "application/pdf" })]);
    expect(useLibrary.getState().uploads[0]).toMatchObject({ status: "error", error: "The PDF is password protected." });
  });

  it("rejects non-PDF files without calling the API", async () => {
    useLibrary.setState({ uploads: [] });
    const fetch = mockFetch({});
    await useLibrary.getState().upload([new File(["x"], "notes.txt", { type: "text/plain" })]);
    expect(fetch).not.toHaveBeenCalled();
    expect(useLibrary.getState().uploads[0].error).toMatch(/only pdf/i);
  });
});

describe("load and selection", () => {
  it("selects everything on first load and keeps the selection afterwards", async () => {
    useLibrary.setState({ loaded: false, selectedIds: [] });
    mockFetch({ "GET /documents": () => jsonResponse([doc("DOC-AAAAAAAA"), doc("DOC-BBBBBBBB")]) });
    await useLibrary.getState().load();
    expect(useLibrary.getState().selectedIds).toHaveLength(2);
    useLibrary.getState().toggle("DOC-AAAAAAAA");
    await useLibrary.getState().load();
    expect(useLibrary.getState().selectedIds).toEqual(["DOC-BBBBBBBB"]);
  });

  it("explains why asking is blocked", () => {
    expect(askBlocker({ documents: [], selectedIds: [], task: "ask" })).toMatch(/upload/i);
    expect(askBlocker({ documents: [doc("A") as never], selectedIds: [], task: "ask" })).toMatch(/select/i);
    expect(askBlocker({ documents: [doc("A") as never], selectedIds: ["A"], task: "compare" })).toMatch(/two/i);
    expect(askBlocker({ documents: [doc("A") as never], selectedIds: ["A"], task: "ask" })).toBeNull();
  });
});
