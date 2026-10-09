import { describe, expect, it } from "vitest";
import type { Source } from "@/lib/api/schemas";
import { citationState, countResolved, findSource, holdPartialCitation, parseGroup, segment } from "@/lib/rag/citations";

const src = (id: string, page: number | null, text = "passage"): Source => ({
  circular_id: id,
  title: "Doc",
  clause_id: null,
  page,
  status: "active",
  origin: "upload",
  text,
  date: "2026-01-01",
});

describe("parseGroup", () => {
  it("parses the backend format", () => {
    expect(parseGroup("DOC-1A2B3C4D, p. 7")).toEqual([{ docId: "DOC-1A2B3C4D", page: 7, raw: "DOC-1A2B3C4D, p. 7" }]);
  });
  it("accepts p, p., page and pp spellings", () => {
    for (const raw of ["DOC-1A2B3C4D, p 7", "DOC-1A2B3C4D,p.7", "DOC-1A2B3C4D, page 7", "DOC-1A2B3C4D, pp. 7"]) {
      expect(parseGroup(raw)[0].page).toBe(7);
    }
  });
  it("splits semicolon groups and uppercases IDs", () => {
    expect(parseGroup("doc-1a2b3c4d, p. 1; DOC-9F8E7D6C").map((r) => [r.docId, r.page])).toEqual([
      ["DOC-1A2B3C4D", 1],
      ["DOC-9F8E7D6C", null],
    ]);
  });
});

describe("segment", () => {
  it("splits prose and numbered citation groups", () => {
    const parts = segment("Rent is due monthly [DOC-1A2B3C4D, p. 2]. Notice is 30 days [DOC-1A2B3C4D, p. 9; DOC-9F8E7D6C, p. 1].");
    const cites = parts.filter((p) => p.kind === "cite");
    expect(cites.map((c) => c.kind === "cite" && c.group)).toEqual([0, 1]);
    expect(parts[0]).toEqual({ kind: "text", text: "Rent is due monthly " });
  });
  it("parses a mistyped ID so it can be flagged as unverified", () => {
    const [cite] = segment("x [DOC-4B3FBCE, p. 6].").filter((p) => p.kind === "cite");
    expect(cite.kind === "cite" && cite.refs[0]).toMatchObject({ docId: "DOC-4B3FBCE", page: 6 });
    expect(citationState({ docId: "DOC-4B3FBCE", page: 6, raw: "" }, [src("DOC-4B3FBFCE", 6)])).toBe("unverified");
  });
  it("leaves ordinary brackets alone", () => {
    expect(segment("See [1] and [note]").every((p) => p.kind === "text")).toBe(true);
  });
  it("stays linear on a long unclosed citation", () => {
    const text = "x [" + "DOC-1A2B3C4D, p. 1; ".repeat(4000);
    const t = performance.now();
    segment(text);
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("holdPartialCitation", () => {
  it("holds a trailing open bracket", () => expect(holdPartialCitation("Due [DOC-1A2B")).toBe("Due "));
  it("releases closed brackets", () => expect(holdPartialCitation("Due [DOC-1A2B3C4D, p. 2].")).toBe("Due [DOC-1A2B3C4D, p. 2]."));
  it("releases after maxHold characters", () => expect(holdPartialCitation("a [" + "x".repeat(200))).toHaveLength(203));
});

describe("resolution against returned passages", () => {
  const sources = [src("DOC-1A2B3C4D", 2), src("DOC-1A2B3C4D", 5)];
  it("is pending before sources arrive", () => {
    expect(citationState({ docId: "DOC-1A2B3C4D", page: 2, raw: "" }, null)).toBe("pending");
  });
  it("needs the cited page to be a returned page", () => {
    expect(citationState({ docId: "DOC-1A2B3C4D", page: 2, raw: "" }, sources)).toBe("resolved");
    expect(citationState({ docId: "DOC-1A2B3C4D", page: 3, raw: "" }, sources)).toBe("unverified");
    expect(citationState({ docId: "DOC-00000000", page: 2, raw: "" }, sources)).toBe("unverified");
  });
  it("counts resolved of total", () => {
    expect(countResolved("A [DOC-1A2B3C4D, p. 2]. B [DOC-1A2B3C4D, p. 3].", sources)).toEqual({ resolved: 1, total: 2 });
  });
  it("finds the passage on the cited page, never a different page", () => {
    expect(findSource({ docId: "DOC-1A2B3C4D", page: 5, raw: "" }, sources)?.page).toBe(5);
    expect(findSource({ docId: "DOC-1A2B3C4D", page: 9, raw: "" }, sources)).toBeNull();
    expect(findSource({ docId: "DOC-1A2B3C4D", page: null, raw: "" }, sources)?.page).toBe(2);
  });
});
