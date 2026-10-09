import { describe, expect, it } from "vitest";
import { contentWords, scoreClaim } from "@/lib/rag/coverage";

describe("coverage (port of verify.py)", () => {
  it("drops stopwords and short words, keeps numbers", () => {
    expect(contentWords("The deposit is refundable within 30 days of it.")).toEqual(["deposit", "refundable", "within", "30", "days"]);
  });
  it("keeps dotted tokens together like the backend tokenizer", () => {
    expect(contentWords("Clause 4.2.1 applies")).toEqual(["clause", "4.2.1", "applies"]);
  });
  const page = "The security deposit is refundable within 30 days of vacating the premises.";
  it("scores supported, partial and unsupported with the same thresholds", () => {
    expect(scoreClaim("The deposit is refundable within 30 days", page).status).toBe("supported");
    expect(scoreClaim("The deposit is refundable after an inspection by the landlord", page).status).toBe("partial");
    expect(scoreClaim("Tenants may keep two cats indoors", page).status).toBe("unsupported");
  });
  it("cannot check very short claims and reports missing pages", () => {
    expect(scoreClaim("Yes, refundable.", page)).toMatchObject({ status: "partial", coverage: 0.5 });
    expect(scoreClaim("Refundable.", page).status).toBe("unchecked");
    expect(scoreClaim("The deposit is refundable", "").status).toBe("not_found");
  });
});
