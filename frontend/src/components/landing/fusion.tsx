"use client";

import * as React from "react";
import { LayoutGroup, motion } from "motion/react";
import { Switch } from "@/components/ui/switch";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DemoLabel } from "./demo-label";

// Illustrative rankings for one question. The fusion arithmetic below is the real formula (k = 60).
const PASSAGES: Record<string, string> = {
  a: "§4 Deposit refunded within 30 days",
  b: "§4 Table: deposit £1,200, due on signing",
  c: "§5 Early termination and notice",
  d: "§12 Definitions: “deposit”",
  e: "§2 Rent payable monthly",
};
const BM25 = ["b", "a", "d", "c"];
const DENSE = ["a", "c", "e", "b"];
const RERANK: Record<string, number> = { a: 7.9, b: 4.1, c: 1.2, d: -2.3, e: -3.0 };
const K = 60;

function rrf(): { key: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of [BM25, DENSE]) list.forEach((key, i) => scores.set(key, (scores.get(key) ?? 0) + 1 / (K + i + 1)));
  return [...scores.entries()].map(([key, score]) => ({ key, score })).sort((x, y) => y.score - x.score);
}

function Ranked({ title, items, note }: { title: string; items: { key: string; score?: string }[]; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="m-0 text-sm font-medium text-ink">{title}</p>
        <p className="m-0 truncate text-[11px] text-ink-subtle">{note}</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {items.map((it, i) => (
          <motion.li layout key={it.key} transition={spring.snappy} className={cn("flex min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]", it.key === "a" && "border-verified/50")}>
            <span className="w-4 shrink-0 font-mono text-[11px] text-ink-subtle tabular">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{PASSAGES[it.key]}</span>
            {it.score && <span className="shrink-0 font-mono text-[11px] text-ink-muted tabular">{it.score}</span>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/** Hybrid retrieval, step by step: two rankings, fused by reciprocal rank, optionally re-scored by a cross-encoder. */
export function Fusion() {
  const [rerank, setRerank] = React.useState(true);
  const fused = rrf();
  const final = rerank ? [...fused].sort((x, y) => RERANK[y.key] - RERANK[x.key]) : fused;
  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface-2 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 font-display text-2xl text-ink">Hybrid retrieval</p>
        <DemoLabel>Illustrative ranks · real formula</DemoLabel>
      </div>
      <LayoutGroup>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Ranked title="BM25 keywords" note="exact terms, numbers, IDs" items={BM25.map((key) => ({ key }))} />
          <Ranked title="Dense vectors" note="meaning, paraphrase" items={DENSE.map((key) => ({ key }))} />
        </div>
        <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-start">
          <Ranked title={rerank ? "Fused, then reranked" : "Reciprocal rank fusion"} note={rerank ? "cross-encoder score" : "Σ 1 / (60 + rank)"} items={final.map((f) => ({ key: f.key, score: rerank ? RERANK[f.key].toFixed(1) : f.score.toFixed(4) }))} />
          <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-muted">
            <p className="m-0">
              A passage scores <code className="font-mono text-ink">1 / (60 + rank)</code> in each list and the scores add up, so something ranked well by both rises to the top.
            </p>
            <div className="rounded-lg border border-line bg-surface px-3">
              <Switch id="demo-rerank" label="Cross-encoder rerank" hint="MiniLM reads question and passage together" checked={rerank} onCheckedChange={setRerank} />
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}
