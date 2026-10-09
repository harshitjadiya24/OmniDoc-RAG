"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { Layers } from "lucide-react";
import type { CitationCheck, Source } from "@/lib/api/schemas";
import { docTypeLabel } from "@/lib/api/documents";
import { segment, sourceKey } from "@/lib/rag/citations";
import { decodeEntities, plural } from "@/lib/format";
import { duration, ease, stagger } from "@/lib/motion";
import { useChats } from "@/stores/chats";
import { isBusy, useConversation } from "@/stores/conversation";
import { useEvidence } from "@/stores/evidence";
import { labelDocuments } from "../conversation/turn-context";
import { SourceCard } from "./source-card";

type Focused = { sources: Source[] | null; checks: CitationCheck[]; answer: string; busy: boolean; compare: string[] | undefined };

function useFocused(): Focused | null {
  const focus = useEvidence((s) => s.focus);
  const transcript = useChats((s) => s.transcript);
  const live = useConversation(useShallow((s) => ({ phase: s.phase, sources: s.sources, checks: s.checks, plan: s.plan, savedId: s.savedId })));
  const liveAnswer = useConversation((s) => (s.phase === "complete" || s.phase === "refused" ? s.answer : ""));
  if (focus.kind === "message") {
    const m = transcript.find((x) => x.id === focus.id);
    if (m && m.id !== live.savedId) return { sources: m.sources, checks: m.citations, answer: m.answer, busy: false, compare: undefined };
  }
  if (live.phase !== "idle") {
    const compare = live.plan?.mode === "compare" ? live.plan.documents.map((d) => d.id) : undefined;
    return { sources: live.sources, checks: live.checks ?? [], answer: liveAnswer, busy: isBusy(live.phase), compare };
  }
  const last = transcript.at(-1);
  return last ? { sources: last.sources, checks: last.citations, answer: last.answer, busy: false, compare: undefined } : null;
}

/** Passages behind the focused answer, grouped by document, with the verdict of each citation that uses them. */
export function EvidencePanel() {
  const focused = useFocused();
  const selected = useEvidence((s) => s.selected);

  if (!focused || (!focused.sources && !focused.busy)) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span aria-hidden className="grid size-12 place-items-center rounded-full border border-line bg-surface-2">
          <Layers className="size-5 text-ink-subtle" />
        </span>
        <p className="m-0 text-sm font-medium text-ink">No evidence yet</p>
        <p className="m-0 max-w-[32ch] text-[13px] leading-relaxed text-ink-muted">Ask a question and the passages the answer was written from appear here, with each citation’s page check.</p>
      </div>
    );
  }

  if (!focused.sources) {
    return (
      <div aria-hidden className="flex flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-28 overflow-hidden rounded-lg border border-line bg-surface-2">
            <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        ))}
      </div>
    );
  }

  const cited = new Set(segment(focused.answer).flatMap((s) => (s.kind === "cite" ? s.refs.map((r) => `${r.docId}|${r.page}`) : [])));
  const groups = new Map<string, Source[]>();
  for (const s of focused.sources) {
    const id = s.circular_id.toUpperCase();
    groups.set(id, [...(groups.get(id) ?? []), s]);
  }
  const labels = labelDocuments(focused.sources, focused.compare);
  const citedCount = focused.sources.filter((s) => cited.has(`${s.circular_id.toUpperCase()}|${s.page}`)).length;
  let rank = 0;

  return (
    <div className="flex min-w-0 flex-col gap-5 p-4">
      <p className="m-0 text-xs text-ink-muted">
        {plural(focused.sources.length, "passage")} from {plural(groups.size, "document")}
        {focused.answer && ` · ${citedCount} cited`}
      </p>
      {focused.sources.length === 0 && <p className="m-0 text-sm text-ink-muted">Retrieval returned no passages for this question.</p>}
      {Array.from(groups.entries()).map(([docId, items]) => (
        <section key={docId} aria-label={decodeEntities(items[0].title)} className="flex min-w-0 flex-col gap-2.5">
          <header className="flex min-w-0 items-start gap-2">
            {labels[docId] && <span className="grid size-5 shrink-0 place-items-center rounded-[4px] bg-inverse font-mono text-[11px] font-semibold text-on-inverse">{labels[docId]}</span>}
            <div className="min-w-0">
              <h3 className="m-0 line-clamp-2 text-[13px] font-semibold text-ink">{decodeEntities(items[0].title)}</h3>
              <p className="m-0 font-mono text-[11px] text-ink-subtle">
                {docId}
                {docTypeLabel(items[0].doc_type) && ` · ${docTypeLabel(items[0].doc_type)}`}
              </p>
            </div>
          </header>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <AnimatePresence initial={false}>
              {items.map((s, i) => {
                rank += 1;
                const key = sourceKey(s);
                const checks = focused.checks.filter((c) => c.doc_id.toUpperCase() === docId && c.page === s.page);
                return (
                  <motion.li key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: stagger(i), duration: duration.slow, ease: ease.outExpo }}>
                    <SourceCard source={s} rank={rank} checks={checks} selected={selected === key} cited={focused.busy ? null : cited.has(`${docId}|${s.page}`)} />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
