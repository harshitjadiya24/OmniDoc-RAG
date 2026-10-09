"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { Plan, StageName } from "@/lib/api/schemas";
import { formatMs } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Stage } from "@/stores/conversation";

const RETRIEVAL: Record<string, string> = {
  hybrid: "BM25 + dense vectors, fused with RRF",
  dense: "Dense vectors (bge-small)",
  bm25: "BM25 keywords",
};

function detail(id: StageName, plan: Plan | null): string {
  switch (id) {
    case "understanding":
      return "Choosing single, multi or compare";
    case "searching":
      return plan?.retrieval ? RETRIEVAL[plan.retrieval.mode] : "Finding candidate passages";
    case "reranking":
      return plan?.retrieval ? (plan.retrieval.rerank ? "Cross-encoder rerank" : "Fusion order, no rerank") : "Ordering passages";
    case "drafting":
      return "Citing every statement";
  }
}

const LABEL: Record<StageName, string> = {
  understanding: "Plan",
  searching: "Retrieve",
  reranking: "Rank",
  drafting: "Draft",
};

/** The four backend stages, forward-only, with measured client-side timings. */
export function PipelineStepper({ stages, plan, live }: { stages: Stage[]; plan: Plan | null; live: boolean }) {
  const active = stages.findIndex((s) => s.status === "active");
  const now = useNow(live && active !== -1);
  return (
    <div className="min-w-0">
      <ol className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-3 p-0 sm:grid-cols-4" aria-label="Answer pipeline">
        {stages.map((s, i) => {
          const elapsed = s.startedAt === null ? null : (s.endedAt ?? (live ? Math.max(now, s.startedAt) : s.startedAt)) - s.startedAt;
          return (
            <li key={s.id} className="flex min-w-0 flex-col gap-1.5" aria-current={s.status === "active" ? "step" : undefined}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "relative grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                    s.status === "done" && "border-transparent bg-verified text-on-verified",
                    s.status === "active" && "border-verified text-verified-text",
                    s.status === "pending" && "border-line-strong text-ink-subtle",
                  )}
                >
                  {s.status === "done" ? (
                    <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.pop}>
                      <Check aria-hidden className="size-3" strokeWidth={3} />
                    </motion.span>
                  ) : s.status === "active" ? (
                    <>
                      <span aria-hidden className="size-1.5 rounded-full bg-verified" />
                      <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full border border-verified" />
                    </>
                  ) : (
                    <span aria-hidden className="font-mono text-[10px]">{i + 1}</span>
                  )}
                </span>
                <span className={cn("text-[13px] font-medium", s.status === "pending" ? "text-ink-subtle" : "text-ink")}>{LABEL[s.id]}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-subtle tabular">{elapsed !== null && s.status !== "pending" ? formatMs(elapsed) : ""}</span>
              </div>
              <div aria-hidden className="h-0.5 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full origin-left rounded-full bg-verified"
                  initial={false}
                  animate={{ scaleX: s.status === "done" ? 1 : s.status === "active" ? 0.55 : 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="m-0 truncate text-[11.5px] text-ink-subtle" title={detail(s.id, plan)}>
                {detail(s.id, plan)}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const STAGE_ANNOUNCE: Record<StageName, string> = {
  understanding: "Planning the answer",
  searching: "Searching documents",
  reranking: "Ranking passages",
  drafting: "Drafting the answer",
};
