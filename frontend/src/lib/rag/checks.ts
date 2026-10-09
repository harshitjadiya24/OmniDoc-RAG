import type { CheckStatus, CitationCheck } from "@/lib/api/schemas";
import { segment } from "./citations";

/** Chip address inside an answer: citation group index, then reference index in that group. */
export const chipKey = (group: number, ref: number) => `${group}:${ref}`;

/**
 * Attach each backend check to the chip that produced it. The backend walks the
 * same answer, so the n-th citation of a document page here is the n-th check
 * for that page there. Matching by page and occurrence (not global position)
 * keeps any citation the backend skipped from shifting every later verdict.
 */
export function assignChecks(answer: string, checks: CitationCheck[]): Record<string, CitationCheck> {
  const queues = new Map<string, CitationCheck[]>();
  for (const check of checks) {
    const key = `${check.doc_id.toUpperCase()}|${check.page ?? ""}`;
    queues.set(key, [...(queues.get(key) ?? []), check]);
  }
  const out: Record<string, CitationCheck> = {};
  for (const seg of segment(answer)) {
    if (seg.kind !== "cite") continue;
    seg.refs.forEach((ref, i) => {
      const next = queues.get(`${ref.docId}|${ref.page ?? ""}`)?.shift();
      if (next) out[chipKey(seg.group, i)] = next;
    });
  }
  return out;
}

export type CheckSummary = Record<CheckStatus, number>;

export function summarizeChecks(checks: CitationCheck[]): CheckSummary {
  const summary: CheckSummary = { supported: 0, partial: 0, unsupported: 0, not_found: 0, unchecked: 0 };
  for (const c of checks) summary[c.status] += 1;
  return summary;
}

export const CHECK_LABEL: Record<CheckStatus, string> = {
  supported: "Supported by the cited page",
  partial: "Partly supported by the cited page",
  unsupported: "Not found on the cited page",
  not_found: "Cited page has no text",
  unchecked: "Too short to check",
};

export const CHECK_SHORT: Record<CheckStatus, string> = {
  supported: "Supported",
  partial: "Partial",
  unsupported: "Unsupported",
  not_found: "Page missing",
  unchecked: "Unchecked",
};

/** "Supported by the cited page: 82% of the statement's key words appear on page 10." */
export function describeCheck(check: CitationCheck): string {
  if (check.coverage === null || check.page === null) return CHECK_LABEL[check.status];
  return `${CHECK_LABEL[check.status]}: ${Math.round(check.coverage * 100)}% of the statement's key words appear on page ${check.page}.`;
}
