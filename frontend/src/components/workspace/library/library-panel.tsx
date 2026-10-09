"use client";

import { AnimatePresence, motion } from "motion/react";
import { CloudOff, Library as LibraryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { duration, stagger } from "@/lib/motion";
import type { Task } from "@/lib/api/schemas";
import { useLibrary } from "@/stores/library";
import { compareOrder } from "./compare-order";
import { DocumentCard } from "./document-card";
import { UploadList } from "./upload-list";
import { UploadZone } from "./upload-zone";
import { isVersioned } from "./versioning";

const TASKS: { value: Task; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "compare", label: "Compare two" },
];

/** Upload, select and inspect documents. Used as a column on wide screens and in a sheet below that. */
export function LibraryPanel({ idPrefix }: { idPrefix: string }) {
  const { documents, selectedIds, task, loaded, error } = useLibrary();
  const { toggle, selectAll, selectNone, setTask, setOpen, load } = useLibrary.getState();

  const selected = documents.filter((d) => selectedIds.includes(d.id));
  const ordered = task === "compare" && selected.length === 2 ? compareOrder(selected) : [];
  const labelOf = (id: string) => {
    const i = ordered.findIndex((d) => d.id === id);
    return i === -1 ? null : "AB"[i];
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Segmented label="Question type" layoutId={`${idPrefix}-task`} items={TASKS} value={task} onChange={setTask} size="sm" className="w-full" />
        <p className="m-0 text-xs leading-relaxed text-ink-subtle" aria-live="polite">
          {task === "ask"
            ? "Questions search every selected document. Mention “each” or “compare” to search them one by one."
            : selected.length === 2
              ? "A is the earlier document (by stated date, else upload time)."
              : `Select exactly two documents to compare (${selected.length} selected).`}
        </p>
      </div>

      <UploadZone compact={documents.length > 0} />
      <UploadList />

      {documents.length > 0 && (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="m-0 text-xs text-ink-muted tabular">
            {selectedIds.length} of {documents.length} selected
          </p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={selectAll} disabled={selectedIds.length === documents.length}>
              All
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone} disabled={selectedIds.length === 0}>
              None
            </Button>
          </div>
        </div>
      )}

      {!loaded && (
        <p className="m-0 flex items-center gap-2 text-sm text-ink-muted">
          <Spinner /> Loading your library…
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-unsupported/35 bg-unsupported-wash p-3">
          <p className="m-0 flex items-start gap-2 text-sm text-ink">
            <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0 text-unsupported-text" />
            <span className="min-w-0 break-anywhere">{error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => void load()} className="self-start">
            Try again
          </Button>
        </div>
      )}

      {loaded && !error && documents.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <LibraryIcon aria-hidden className="size-5 text-ink-subtle" />
          <p className="m-0 text-sm text-ink-muted">No documents yet.</p>
          <p className="m-0 max-w-[30ch] text-xs text-ink-subtle">Contracts, papers, reports, regulations and manuals are detected automatically.</p>
        </div>
      )}

      <ul aria-label="Documents" className="m-0 flex list-none flex-col gap-2 p-0">
        <AnimatePresence initial={false}>
          {documents.map((doc, i) => (
            <motion.li
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: stagger(i), duration: duration.base } }}
              exit={{ opacity: 0, x: -12, transition: { duration: duration.fast } }}
            >
              <DocumentCard
                doc={doc}
                selected={selectedIds.includes(doc.id)}
                compareLabel={labelOf(doc.id)}
                versioned={isVersioned(doc, documents)}
                onToggle={() => toggle(doc.id)}
                onOpen={() => setOpen(doc.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
