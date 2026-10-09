/*
 * A faithful port of backend/src/docqa/verify.py's scoring, used by the
 * landing page's interactive explainer. Same stopwords, tokenizer and
 * thresholds, so the demo computes what the real page check computes.
 */
import type { CheckStatus } from "@/lib/api/schemas";

const STOP = new Set(
  (
    "a an and are as at be been by can could did do does for from had has have if in into is it its may might must not of on or shall should so such " +
    "than that the their them then there these this those to under upon was were what when where which while who will with would you your also any " +
    "per all each other only same both either"
  ).split(" "),
);
const WORD = /[a-z0-9]+(?:[.'][a-z0-9]+)*/g;

export const SUPPORTED = 0.7;
export const PARTIAL = 0.4;
export const MIN_WORDS = 2;

export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter((w) => !STOP.has(w) && (w.length > 2 || /^\d+$/.test(w)));
}

export type Coverage = { status: CheckStatus; coverage: number | null; words: string[]; found: string[] };

export function scoreClaim(claim: string, page: string): Coverage {
  const words = Array.from(new Set(contentWords(claim)));
  if (!page.trim()) return { status: "not_found", coverage: null, words, found: [] };
  if (words.length < MIN_WORDS) return { status: "unchecked", coverage: null, words, found: [] };
  const onPage = new Set(contentWords(page));
  const found = words.filter((w) => onPage.has(w));
  const coverage = Math.round((found.length / words.length) * 100) / 100;
  return { status: coverage >= SUPPORTED ? "supported" : coverage >= PARTIAL ? "partial" : "unsupported", coverage, words, found };
}
