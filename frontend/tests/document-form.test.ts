import { describe, expect, it } from "vitest";
import type { LibraryDocument } from "@/lib/api/schemas";
import { diff, formFrom, parseSupersedes, validate } from "@/lib/document-form";
import { decodeEntities } from "@/lib/format";

const doc = {
  id: "DOC-1A2B3C4D",
  title: "Lease agreement",
  doc_type: "contract",
  issuer: null,
  doc_date: "2024-01-05",
  reference: null,
  supersedes: [],
} as unknown as LibraryDocument;

describe("document form", () => {
  it("produces an empty patch when nothing changed", () => {
    expect(diff(doc, formFrom(doc))).toEqual({});
  });
  it("sends only changed fields, trimmed, with blanks as null", () => {
    const form = { ...formFrom(doc), title: "  Lease   agreement 2025 ", issuer: "  ", doc_date: "", supersedes: "DOC-AAAAAAAA, RBI/2024-25/1\nDOC-AAAAAAAA" };
    expect(diff(doc, form)).toEqual({ title: "Lease agreement 2025", doc_date: null, supersedes: ["DOC-AAAAAAAA", "RBI/2024-25/1"] });
  });
  it("validates title, date and supersedes entries", () => {
    expect(validate({ ...formFrom(doc), title: " " })).toMatch(/title/i);
    expect(validate({ ...formFrom(doc), doc_date: "2024-1-5" })).toMatch(/date/i);
    expect(validate({ ...formFrom(doc), supersedes: "x".repeat(121) })).toMatch(/120/);
    expect(validate(formFrom(doc))).toBeNull();
  });
  it("dedupes superseded entries", () => {
    expect(parseSupersedes("a\n a ,b,,")).toEqual(["a", "b"]);
  });
});

describe("decodeEntities", () => {
  it("decodes numeric and named entities and leaves unknown ones", () => {
    expect(decodeEntities("Goals&#x2014;A Survey &amp; More &#8211; x &bogus;")).toBe("Goals—A Survey & More – x &bogus;");
  });
});
