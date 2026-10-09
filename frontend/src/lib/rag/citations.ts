import type { Source } from "@/lib/api/schemas";

/*
 * Citations in answers look like [DOC-1A2B3C4D, p. 7]. A bracket may hold
 * several, separated by ";": [DOC-1A2B3C4D, p. 7; DOC-9F8E7D6C, p. 2].
 * Only document IDs count, so ordinary brackets in prose are left alone.
 * Every repetition has its own separator, so matching stays linear even while
 * an unclosed citation is still streaming in.
 */
const ID = String.raw`DOC-[0-9A-Fa-f]{8}`;
const PAGE = String.raw`\s*,\s*p(?:age|p)?\.?\s*\d+`;
const REF = `${ID}(?:${PAGE})?`;
const GROUP_SOURCE = String.raw`\[(${REF}(?:\s*;\s*${REF})*)\]`;
const PART = new RegExp(String.raw`^(${ID})(?:\s*,\s*p(?:age|p)?\.?\s*(\d+))?$`, "i");

export type CitationRef = { docId: string; page: number | null; raw: string };

export type Segment = { kind: "text"; text: string } | { kind: "cite"; raw: string; refs: CitationRef[]; group: number };

export function parseGroup(inner: string): CitationRef[] {
  return inner
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((raw) => {
      const m = raw.match(PART);
      return m ? [{ docId: m[1].toUpperCase(), page: m[2] ? Number(m[2]) : null, raw }] : [];
    });
}

/** Splits answer text into prose and citation groups, numbering the groups in order. */
export function segment(text: string): Segment[] {
  const out: Segment[] = [];
  const re = new RegExp(GROUP_SOURCE, "gi");
  let last = 0;
  let group = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: "cite", raw: m[0], refs: parseGroup(m[1]), group: group++ });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** While streaming, hold back a trailing "[" until its "]" arrives so half a citation never flashes as text. */
export function holdPartialCitation(text: string, maxHold = 120): string {
  const open = text.lastIndexOf("[");
  if (open === -1) return text;
  const tail = text.slice(open);
  if (tail.includes("]") || tail.length > maxHold) return text;
  return text.slice(0, open);
}

/** A citation matches a returned passage when the document matches and the cited page, if any, is that passage's page. */
export function matchesSource(ref: CitationRef, source: Source): boolean {
  if (ref.docId !== source.circular_id.toUpperCase()) return false;
  return ref.page === null || source.page === null || ref.page === source.page;
}

export type CitationState = "pending" | "resolved" | "unverified";

export function citationState(ref: CitationRef, sources: Source[] | null): CitationState {
  if (!sources) return "pending";
  return sources.some((s) => matchesSource(ref, s)) ? "resolved" : "unverified";
}

/** The passage a citation points at: same page first, else the first passage of that document. */
export function findSource(ref: CitationRef, sources: Source[] | null): Source | null {
  if (!sources) return null;
  const sameDoc = sources.filter((s) => s.circular_id.toUpperCase() === ref.docId);
  return sameDoc.find((s) => ref.page !== null && s.page === ref.page) ?? (ref.page === null ? (sameDoc[0] ?? null) : null);
}

export function countResolved(answer: string, sources: Source[]): { resolved: number; total: number } {
  const refs = segment(answer).flatMap((s) => (s.kind === "cite" ? s.refs : []));
  return { resolved: refs.filter((r) => sources.some((s) => matchesSource(r, s))).length, total: refs.length };
}

/** Stable identity for a returned passage. */
export function sourceKey(s: Pick<Source, "circular_id" | "clause_id" | "page" | "text">): string {
  return `${s.circular_id}:${s.page ?? ""}:${s.clause_id ?? ""}:${s.text.length}`;
}

export function formatCitation(ref: { docId: string; page: number | null }): string {
  return ref.page === null ? ref.docId : `${ref.docId} · p. ${ref.page}`;
}
