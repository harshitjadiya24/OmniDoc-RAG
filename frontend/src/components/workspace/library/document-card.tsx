"use client";

import { Check, FileText, Info, ScanText } from "lucide-react";
import { Badge, VersionBadge } from "@/components/ui/badges";
import { docTypeLabel } from "@/lib/api/documents";
import type { LibraryDocument } from "@/lib/api/schemas";
import { decodeEntities, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  doc: LibraryDocument;
  selected: boolean;
  /** "A" or "B" when this document is half of a comparison. */
  compareLabel: string | null;
  versioned: boolean;
  onToggle: () => void;
  onOpen: () => void;
};

export function DocumentCard({ doc, selected, compareLabel, versioned, onToggle, onOpen }: Props) {
  const type = docTypeLabel(doc.doc_type);
  return (
    <div
      data-selected={selected}
      className={cn(
        "group relative flex min-w-0 gap-3 rounded-lg border p-3 transition-colors",
        selected ? "border-verified/45 bg-verified-wash" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="peer sr-only" />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-verified",
            selected ? "border-transparent bg-verified text-on-verified" : "border-line-strong bg-surface-2",
          )}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-start gap-2">
            {compareLabel && (
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-[4px] bg-inverse font-mono text-[11px] font-semibold text-on-inverse">
                <span className="sr-only">Document </span>
                {compareLabel}
              </span>
            )}
            <span className="line-clamp-2 min-w-0 text-sm leading-snug font-medium break-anywhere text-ink" title={decodeEntities(doc.title)}>
              {decodeEntities(doc.title)}
            </span>
          </span>
          <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
            {type && <Badge>{type}</Badge>}
            <span className="inline-flex items-center gap-1 tabular">
              <FileText aria-hidden className="size-3" />
              {plural(doc.page_count, "page")}
            </span>
            {doc.ocr_pages > 0 && (
              <span className="inline-flex items-center gap-1 tabular">
                <ScanText aria-hidden className="size-3" />
                {doc.ocr_pages} OCR
              </span>
            )}
            {versioned && <VersionBadge status={doc.status} supersededBy={doc.superseded_by} />}
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Details for ${decodeEntities(doc.title)}`}
        className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <Info className="size-4" />
      </button>
    </div>
  );
}
