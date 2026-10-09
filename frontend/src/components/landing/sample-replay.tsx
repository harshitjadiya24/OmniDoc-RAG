"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { CHECK_ICON } from "@/components/ui/badges";
import { useReplay } from "@/hooks/use-replay";
import { SAMPLE_ANSWER, SAMPLE_DOC, SAMPLE_QUESTION } from "@/lib/landing/sample";
import { CHECK_SHORT } from "@/lib/rag/checks";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DemoLabel } from "./demo-label";

const STAGES = ["Plan", "Retrieve", "Rank", "Draft"];
const STAGE_AT = [700, 1300, 2100, 2500];
const TOKENS_AT = 2800;
const MS_PER_WORD = 42;
const LENGTH = 11_500;

// Flatten the script into words so it can stream; citations count as one word each.
const WORDS = SAMPLE_ANSWER.flatMap((part, i) => ("text" in part ? part.text.split(/(?<=\s)/).map((w) => ({ w, i })) : [{ w: "", i }]));
const DONE_AT = TOKENS_AT + WORDS.length * MS_PER_WORD;
const VERDICT_AT = DONE_AT + 300;
const STILL = LENGTH - 1;
/** Ordinal of each citation in the script, so verdicts land one after another. */
const CITE_ORDER = new Map(SAMPLE_ANSWER.flatMap((p, i) => ("cite" in p ? [i] : [])).map((i, n) => [i, n]));

const CHIP = {
  supported: "border-verified/40 bg-verified-wash text-verified-text",
  partial: "border-partial/45 bg-partial-wash text-partial-text",
  unsupported: "border-unsupported/45 bg-unsupported-wash text-unsupported-text",
  not_found: "border-neutral/40 bg-neutral-wash text-neutral-text",
  unchecked: "border-neutral/40 bg-neutral-wash text-neutral-text",
} as const;

/** The hero demo: a scripted replay of one answer streaming, then its citations being page-checked. */
export function SampleReplay() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { t, restart } = useReplay(ref, LENGTH, STILL);
  const shownWords = Math.max(0, Math.min(WORDS.length, Math.floor((t - TOKENS_AT) / MS_PER_WORD)));
  const visibleParts = new Set(WORDS.slice(0, shownWords).map((x) => x.i));

  return (
    <div ref={ref} className="relative min-w-0">
      <div aria-hidden className="absolute inset-0 -z-10 rounded-[40px] lg:-inset-8 bg-[radial-gradient(60%_60%_at_60%_40%,var(--glow),transparent_70%)] opacity-70" />
      <figure className="m-0 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-panel">
        <figcaption className="flex min-w-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </span>
          <DemoLabel />
          <button type="button" onClick={restart} aria-label="Replay the demo" className="grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-surface-3 hover:text-ink">
            <RotateCcw className="size-3.5" />
          </button>
        </figcaption>

        <div className="flex flex-col gap-4 p-4 sm:p-5" aria-hidden>
          <div className="flex justify-end">
            <p className="m-0 max-w-[88%] rounded-xl rounded-br-sm bg-inverse px-3.5 py-2 text-sm text-on-inverse">{SAMPLE_QUESTION}</p>
          </div>

          <ol className="m-0 grid list-none grid-cols-4 gap-2 p-0">
            {STAGES.map((s, i) => {
              const done = t >= (STAGE_AT[i + 1] ?? DONE_AT);
              const active = !done && t >= STAGE_AT[i];
              return (
                <li key={s} className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium">
                    <span className={cn("grid size-4 place-items-center rounded-full border transition-colors", done ? "border-transparent bg-verified text-on-verified" : active ? "border-verified" : "border-line-strong")}>
                      {done && <Check className="size-2.5" strokeWidth={3.5} />}
                      {active && <span className="size-1 rounded-full bg-verified" />}
                    </span>
                    <span className={done || active ? "text-ink" : "text-ink-subtle"}>{s}</span>
                  </span>
                  <span className="h-0.5 overflow-hidden rounded-full bg-line">
                    <span className="block h-full origin-left bg-verified transition-transform duration-500" style={{ transform: `scaleX(${done ? 1 : active ? 0.5 : 0})` }} />
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="m-0 min-h-[7.5rem] text-[15px] leading-[1.75] text-ink">
            {SAMPLE_ANSWER.map((part, i) => {
              if ("text" in part) {
                const words = WORDS.filter((x, k) => x.i === i && k < shownWords).map((x) => x.w);
                return <React.Fragment key={i}>{words.join("")}</React.Fragment>;
              }
              if (!visibleParts.has(i)) return null;
              const checked = t >= VERDICT_AT + (CITE_ORDER.get(i) ?? 0) * 260;
              const Icon = CHECK_ICON[part.cite.status];
              return (
                <span
                  key={i}
                  className={cn(
                    "mx-0.5 inline-flex h-[1.45em] translate-y-[-0.08em] items-center gap-1 rounded-[5px] border px-1.5 align-middle font-mono text-[0.72em] font-medium transition-colors duration-300",
                    checked ? CHIP[part.cite.status] : "border-line-strong bg-surface-2 text-ink-muted",
                  )}
                >
                  {checked && <Icon className="size-[1.1em]" />}p.{part.cite.page}
                </span>
              );
            })}
            {t >= TOKENS_AT && shownWords < WORDS.length && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-verified" />}
          </p>

          <AnimatePresence>
            {t >= VERDICT_AT + 900 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.slow, ease: ease.outExpo }}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
              >
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-medium text-ink">Page check</span>
                  <span className="truncate font-mono text-[11px] text-ink-subtle">{SAMPLE_DOC.id}</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full">
                  <span className="w-2/3 bg-verified" />
                  <span className="w-1/3 bg-partial" />
                </div>
                <div className="flex flex-wrap gap-3 text-[11.5px] text-ink-muted">
                  <span>2 {CHECK_SHORT.supported.toLowerCase()}</span>
                  <span>1 {CHECK_SHORT.partial.toLowerCase()}</span>
                  <span className="ml-auto">Citations resolved 3 of 3</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="sr-only">
          A scripted example. The question “{SAMPLE_QUESTION}” is answered from a fictional lease. Two citations are supported by their pages and one, about pets, is only
          partly supported.
        </p>
      </figure>
    </div>
  );
}
