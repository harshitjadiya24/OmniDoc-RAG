import { describe, expect, it } from "vitest";
import { sanitizeSettings } from "@/stores/settings";

describe("sanitizeSettings", () => {
  it("keeps valid fields", () => {
    expect(sanitizeSettings({ mode: "bm25", rerank: false, rewrite: true, provider: "gemini" })).toEqual({
      mode: "bm25",
      rerank: false,
      rewrite: true,
      provider: "gemini",
    });
  });
  it("drops stale or corrupt values", () => {
    expect(sanitizeSettings({ mode: "keyword", rerank: "yes", provider: "anthropic", onlyActive: true })).toEqual({});
    expect(sanitizeSettings("garbage")).toEqual({});
    expect(sanitizeSettings(null)).toEqual({});
  });
});
