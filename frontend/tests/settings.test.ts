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
  it("accepts every provider the server offers", () => {
    expect(sanitizeSettings({ provider: "groq" })).toEqual({ provider: "groq" });
    expect(sanitizeSettings({ provider: "mistral" })).toEqual({ provider: "mistral" });
    expect(sanitizeSettings({ provider: "openrouter" })).toEqual({ provider: "openrouter" });
  });
  it("drops stale or corrupt values", () => {
    expect(sanitizeSettings({ mode: "keyword", rerank: "yes", provider: "anthropic", onlyActive: true })).toEqual({});
    expect(sanitizeSettings("garbage")).toEqual({});
    expect(sanitizeSettings(null)).toEqual({});
  });
});
