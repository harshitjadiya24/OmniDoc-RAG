"use client";

import { motion } from "motion/react";
import { ArrowUpRight, FileCheck2, Quote, ShieldQuestion } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { decodeEntities } from "@/lib/format";
import { duration, ease, stagger } from "@/lib/motion";
import { useConversation } from "@/stores/conversation";
import { askBlocker, useLibrary } from "@/stores/library";
import { useUi } from "@/stores/ui";

const PROMISES = [
  { icon: Quote, title: "Every statement cites a page", body: "Answers use only your documents and point at the page each claim comes from." },
  { icon: FileCheck2, title: "Every citation is checked", body: "The cited page is re-read and scored for word overlap: supported, partial or unsupported." },
  { icon: ShieldQuestion, title: "No evidence, no answer", body: "When the passages don’t answer the question, you get a refusal instead of a guess." },
];

export function EmptyState() {
  const library = useLibrary(useShallow((s) => ({ documents: s.documents, selectedIds: s.selectedIds, task: s.task, loaded: s.loaded })));
  const submit = useConversation((s) => s.submit);
  const blocked = askBlocker(library) !== null;
  const suggestions = library.documents
    .filter((d) => library.selectedIds.includes(d.id))
    .flatMap((d) => d.example_questions.map((q) => ({ q, doc: decodeEntities(d.title) })))
    .slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-1 py-[clamp(1.5rem,6vh,4rem)]">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.cinematic, ease: ease.outExpo }}>
        <p className="eyebrow m-0">Grounded answers</p>
        <h2 className="m-0 mt-3 font-display text-[clamp(2.25rem,1.4rem+3vw,3.5rem)] leading-[1.02] font-normal tracking-[-0.01em]">
          Ask your documents. <em className="text-verified-text">Check every answer.</em>
        </h2>
      </motion.div>

      {library.loaded && library.documents.length === 0 && (
        <button
          type="button"
          onClick={() => useUi.getState().setLibrarySheet(true)}
          className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2 px-4 py-3 text-left text-sm text-ink transition-colors hover:border-verified/60 xl:hidden"
        >
          Upload a PDF to begin <ArrowUpRight aria-hidden className="size-4 shrink-0" />
        </button>
      )}

      {suggestions.length > 0 && (
        <section aria-labelledby="suggested" className="flex flex-col gap-2.5">
          <h3 id="suggested" className="eyebrow m-0">
            Suggested from your documents
          </h3>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {suggestions.map(({ q, doc }, i) => (
              <motion.li key={q} className="min-w-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + stagger(i, 0.06), duration: duration.slow, ease: ease.outExpo }}>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => void submit(q)}
                  className="group flex h-full min-h-20 w-full min-w-0 flex-col justify-between gap-2 rounded-lg border border-line bg-surface p-3.5 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-verified/50 disabled:opacity-50 motion-reduce:hover:translate-y-0"
                >
                  <span className="text-sm leading-snug text-ink break-anywhere">{q}</span>
                  <span className="truncate text-xs text-ink-subtle" title={doc}>
                    {doc}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <ul className="m-0 grid list-none grid-cols-1 gap-5 border-t border-line p-0 pt-8 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, body }, i) => (
          <motion.li key={title} className="flex min-w-0 flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + stagger(i, 0.08), duration: duration.slow }}>
            <Icon aria-hidden className="size-4 text-verified-text" />
            <p className="m-0 text-sm font-medium text-ink">{title}</p>
            <p className="m-0 text-[13px] leading-relaxed text-ink-muted">{body}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
