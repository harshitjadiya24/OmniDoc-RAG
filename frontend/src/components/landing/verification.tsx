"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CheckBadge } from "@/components/ui/badges";
import { CoverageRing } from "@/components/workspace/conversation/coverage-ring";
import { VERIFY_CLAIMS, VERIFY_PAGE } from "@/lib/landing/sample";
import { contentWords, PARTIAL, scoreClaim, SUPPORTED } from "@/lib/rag/coverage";
import { cn } from "@/lib/utils";
import { DemoLabel } from "./demo-label";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Highlights page words that match the claim's content words. */
function Page({ found }: { found: Set<string> }) {
  const parts = VERIFY_PAGE.split(/(\s+)/);
  return (
    <p className="m-0 font-serif text-[15px] leading-[1.8] text-ink-muted">
      {parts.map((part, i) => {
        const hit = contentWords(part).some((w) => found.has(w));
        return (
          <span key={i} className={cn("rounded-[3px] transition-colors duration-300", hit && "bg-mark text-ink")}>
            {part}
          </span>
        );
      })}
    </p>
  );
}

export function Verification() {
  const [index, setIndex] = React.useState(0);
  const { claim, note } = VERIFY_CLAIMS[index];
  const result = scoreClaim(claim, VERIFY_PAGE);
  const found = new Set(result.found);

  return (
    <Section
      id="verification"
      index="04"
      eyebrow="Verification"
      title={
        <>
          Every citation is <em>checked against its page.</em>
        </>
      }
      lede="After the answer is written, the server takes each statement, drops the stopwords, and counts how many of its key words actually appear on the page it cites. Try it: this runs the same scoring in your browser."
    >
      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="eyebrow mb-3 p-0">Pick a statement that cites page 4</legend>
          {VERIFY_CLAIMS.map((c, i) => {
            const r = scoreClaim(c.claim, VERIFY_PAGE);
            return (
              <label
                key={c.claim}
                className={cn(
                  "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  index === i ? "border-verified/50 bg-surface" : "border-line bg-surface-2 hover:border-line-strong",
                )}
              >
                <input type="radio" name="claim" checked={index === i} onChange={() => setIndex(i)} className="mt-1 accent-[var(--verified-fill)]" />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-[15px] leading-snug text-ink">“{c.claim}”</span>
                  <CheckBadge status={r.status} className="self-start" />
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow m-0">Cited page · p.4</p>
            <DemoLabel>Live scoring · fictional page</DemoLabel>
          </div>
          <Page found={found} />
          <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <motion.div key={index} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3">
              {result.coverage !== null && <CoverageRing value={result.coverage} status={result.status} size={64} />}
              <div className="flex flex-col gap-1.5">
                <CheckBadge status={result.status} />
                <span className="font-mono text-xs text-ink-muted tabular">
                  {result.found.length} of {result.words.length} key words
                </span>
              </div>
            </motion.div>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="m-0 text-[13px] text-ink-muted">Key words in the statement</p>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Key words, found or missing">
                {result.words.map((w) => (
                  <li key={w} className={cn("rounded-[4px] px-1.5 py-0.5 font-mono text-xs", found.has(w) ? "bg-verified-wash text-verified-text" : "bg-unsupported-wash text-unsupported-text line-through")}>
                    {w}
                    <span className="sr-only">{found.has(w) ? " (on the page)" : " (missing)"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className={cn("m-0 rounded-lg p-3 text-sm leading-relaxed", index === 3 ? "bg-partial-wash text-ink" : "bg-surface-2 text-ink-muted")} aria-live="polite">
            {note}
          </p>
          <p className="m-0 font-mono text-[11.5px] text-ink-subtle">
            supported ≥ {SUPPORTED * 100}% · partial ≥ {PARTIAL * 100}% · unsupported below · fewer than 2 key words: unchecked
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
