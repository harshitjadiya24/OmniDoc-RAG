import { describe, expect, it } from "vitest";
import type { CitationCheck } from "@/lib/api/schemas";
import { assignChecks, describeCheck, summarizeChecks } from "@/lib/rag/checks";

const check = (doc_id: string, page: number | null, status: CitationCheck["status"], coverage: number | null = null): CitationCheck => ({
  doc_id,
  page,
  status,
  coverage,
  claim: "claim",
  evidence: null,
});

describe("assignChecks", () => {
  it("pairs checks with chips by document page and occurrence", () => {
    const answer = "A [DOC-1A2B3C4D, p. 2]. B [DOC-9F8E7D6C, p. 1; DOC-1A2B3C4D, p. 2].";
    const out = assignChecks(answer, [check("DOC-1A2B3C4D", 2, "supported"), check("DOC-9F8E7D6C", 1, "partial"), check("DOC-1A2B3C4D", 2, "unsupported")]);
    expect(out["0:0"].status).toBe("supported");
    expect(out["1:0"].status).toBe("partial");
    expect(out["1:1"].status).toBe("unsupported");
  });
  it("leaves chips without a matching check unassigned", () => {
    expect(assignChecks("A [DOC-1A2B3C4D, p. 2].", [])).toEqual({});
  });
});

describe("summaries and copy", () => {
  it("counts each status", () => {
    expect(summarizeChecks([check("D", 1, "supported"), check("D", 2, "supported"), check("D", 3, "partial")])).toMatchObject({
      supported: 2,
      partial: 1,
      unsupported: 0,
    });
  });
  it("describes coverage honestly", () => {
    expect(describeCheck(check("D", 10, "supported", 0.82))).toBe("Supported by the cited page: 82% of the statement's key words appear on page 10.");
    expect(describeCheck(check("D", null, "unchecked"))).toBe("Too short to check");
  });
});
