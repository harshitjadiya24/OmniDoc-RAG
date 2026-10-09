"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { CHECK_ICON } from "@/components/ui/badges";
import { CHECK_STATUSES, type CitationCheck, type Source, type Usage } from "@/lib/api/schemas";
import { CHECK_SHORT, summarizeChecks } from "@/lib/rag/checks";
import { countResolved } from "@/lib/rag/citations";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";

const BAR: Record<string, string> = {
  supported: "bg-verified",
  partial: "bg-partial",
  unsupported: "bg-unsupported",
  not_found: "bg-neutral",
  unchecked: "bg-neutral/50",
};

/** Page-check summary as a proportional bar with counts. */
export function CheckSummary({ checks }: { checks: CitationCheck[] }) {
  const summary = summarizeChecks(checks);
  const total = checks.length;
  if (!total) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        {CHECK_STATUSES.map((s) => (summary[s] ? <span key={s} className={BAR[s]} style={{ width: `${(summary[s] / total) * 100}%` }} /> : null))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-ink-muted" aria-label="Page check results">
        {CHECK_STATUSES.filter((s) => summary[s]).map((s) => {
          const Icon = CHECK_ICON[s];
          return (
            <li key={s} className="inline-flex items-center gap-1">
              <Icon aria-hidden className="size-3.5" />
              <span className="font-mono tabular">{summary[s]}</span> {CHECK_SHORT[s].toLowerCase()}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One fact; `source` says whether the backend reported it or the client derived it. */
function Fact({ label, value, source }: { label: string; value: React.ReactNode; source?: "reported" | "derived" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] tracking-[0.08em] text-ink-muted uppercase">{label}</dt>
      <dd className="m-0 truncate font-mono text-[12.5px] text-ink tabular" title={typeof value === "string" ? value : undefined}>
        {value}
      </dd>
      {source && <dd className="m-0 text-[10.5px] text-ink-muted">{source === "reported" ? "reported by API" : "derived here"}</dd>}
    </div>
  );
}

/** Facts about a finished answer. Each number is either reported by the backend or derived on the client, and says which. */
export function AnswerMeta({ answer, sources, checks, usage, chunks }: { answer: string; sources: Source[]; checks: CitationCheck[]; usage: Usage | null; chunks: number | null }) {
  const [copied, setCopied] = React.useState(false);
  const { resolved, total } = countResolved(answer, sources);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-2 text-[13px] font-medium text-ink">
            Page check <span className="font-normal text-ink-muted">· word overlap with each cited page</span>
          </p>
          {checks.length ? <CheckSummary checks={checks} /> : <p className="m-0 text-xs text-ink-subtle">No citations to check.</p>}
        </div>
        <button type="button" onClick={copy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-muted hover:bg-surface-3 hover:text-ink">
          {copied ? <Check aria-hidden className="size-4 text-verified-text" /> : <Copy aria-hidden className="size-4" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <dl className={cn("m-0 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-3", usage && "lg:grid-cols-5")}>
        <Fact label="Citations resolved" value={`${resolved} of ${total}`} source="derived" />
        <Fact label="Passages" value={usage?.passages_checked ?? sources.length} source={usage?.passages_checked !== undefined ? "reported" : "derived"} />
        {usage && <Fact label="Latency" value={formatMs(usage.latency_ms)} source="reported" />}
        {usage?.model && <Fact label="Model" value={usage.model} source="reported" />}
        {chunks !== null && <Fact label="Stream chunks" value={chunks} source="derived" />}
      </dl>
    </div>
  );
}
