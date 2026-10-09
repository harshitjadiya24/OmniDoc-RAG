"use client";

import * as React from "react";
import { FileSearch } from "lucide-react";
import { Badge, CheckBadge, VersionBadge } from "@/components/ui/badges";
import type { CitationCheck, Source } from "@/lib/api/schemas";
import { decodeEntities } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEvidence } from "@/stores/evidence";

const RANK: Record<CitationCheck["status"], number> = { unsupported: 0, not_found: 1, partial: 2, unchecked: 3, supported: 4 };

/** One retrieved passage, with the verdicts of the citations that point at its page. */
export function SourceCard({ source, rank, checks, selected, cited }: { source: Source; rank: number; checks: CitationCheck[]; selected: boolean; cited: boolean | null }) {
  const ref = React.useRef<HTMLElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const hovered = useEvidence((s) => s.hoveredDoc === source.circular_id.toUpperCase() && (s.hoveredPage === null || s.hoveredPage === source.page));
  const openPdf = useEvidence((s) => s.openPdf);
  const long = source.text.length > 420;
  const worst = [...checks].sort((a, b) => RANK[a.status] - RANK[b.status])[0];

  React.useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [selected]);

  return (
    <article
      ref={ref}
      aria-label={`Passage ${rank}${source.page !== null ? `, page ${source.page}` : ""}`}
      data-selected={selected}
      className={cn(
        "relative min-w-0 rounded-lg border bg-surface p-3.5 transition-[border-color,box-shadow] duration-300",
        selected || hovered ? "border-verified/60 shadow-[0_0_0_3px_var(--glow)]" : "border-line",
        cited === false && "bg-surface-2",
      )}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-mono text-[11px] text-ink-subtle tabular">#{rank}</span>
        {source.page !== null && <span className="font-mono text-xs font-medium text-ink tabular">p.{source.page}</span>}
        {source.clause_id && (
          <span className="min-w-0 truncate text-xs text-ink-muted" title={decodeEntities(source.clause_id)}>
            § {decodeEntities(source.clause_id)}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {source.versioned && <VersionBadge status={source.status} supersededBy={source.superseded_by} />}
          {worst ? <CheckBadge status={worst.status} /> : <Badge>{cited === null ? "Retrieved" : cited ? "Cited" : "Not cited"}</Badge>}
        </span>
      </header>
      <p className={cn("m-0 mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-muted break-anywhere", long && !expanded && "line-clamp-6")}>{source.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="inline-flex h-8 items-center rounded-md px-2 text-xs text-ink-muted hover:bg-surface-3 hover:text-ink">
            {expanded ? "Show less" : "Show full passage"}
          </button>
        )}
        {source.page !== null && (
          <button
            type="button"
            onClick={() =>
              openPdf({ docId: source.circular_id, page: source.page!, title: decodeEntities(source.title), passage: source.text, evidence: worst?.evidence ?? null })
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-verified-text hover:bg-verified-wash"
          >
            <FileSearch aria-hidden className="size-3.5" /> View page {source.page}
          </button>
        )}
        {checks.length > 1 && <span className="ml-auto text-[11px] text-ink-subtle">Cited {checks.length} times</span>}
      </div>
    </article>
  );
}
