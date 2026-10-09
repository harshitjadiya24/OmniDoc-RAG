"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { CircleHelp, FileSearch, ListTree } from "lucide-react";
import { CHECK_ICON, CheckBadge } from "@/components/ui/badges";
import { Spinner } from "@/components/ui/spinner";
import { citationState, findSource, sourceKey, type CitationRef } from "@/lib/rag/citations";
import { CHECK_LABEL, chipKey, describeCheck } from "@/lib/rag/checks";
import { decodeEntities } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEvidence } from "@/stores/evidence";
import { CoverageRing } from "./coverage-ring";
import { useTurn } from "./turn-context";

const VERDICT_STYLE = {
  supported: "border-verified/40 bg-verified-wash text-verified-text",
  partial: "border-partial/45 bg-partial-wash text-partial-text",
  unsupported: "border-unsupported/45 bg-unsupported-wash text-unsupported-text",
  not_found: "border-neutral/40 bg-neutral-wash text-neutral-text",
  unchecked: "border-neutral/40 bg-neutral-wash text-neutral-text",
} as const;

/** One citation inside running text. It never scales (it would overlap its neighbours); hover and focus shift ring and fill. */
export function CitationChip({ group, index, cite }: { group: number; index: number; cite: CitationRef }) {
  const turn = useTurn();
  const check = turn.checkByChip[chipKey(group, index)];
  const state = citationState(cite, turn.sources);
  const source = findSource(cite, turn.sources);
  const label = turn.docLabels[cite.docId];
  const title = turn.titles[cite.docId] ?? cite.docId;
  const { hover, focusTurn, openPdf, setSheetOpen } = useEvidence.getState();

  const Icon = check ? CHECK_ICON[check.status] : state === "unverified" ? CircleHelp : null;
  const verdict = check ? CHECK_LABEL[check.status] : state === "unverified" ? "Unverified citation: the cited page was not among the returned passages" : state === "pending" ? "Checking" : "Matches a returned passage";
  const name = `Citation: ${decodeEntities(title)}${cite.page !== null ? `, page ${cite.page}` : ""}. ${verdict}.`;

  const showPassage = () => {
    focusTurn(turn.focus, source ? sourceKey(source) : null);
    if (window.matchMedia("(max-width: 1023px)").matches) setSheetOpen(true);
  };
  const viewPage = () => {
    if (cite.page === null) return;
    openPdf({ docId: cite.docId, page: cite.page, title: decodeEntities(title), passage: source?.text ?? null, evidence: check?.evidence ?? null });
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={name}
          data-chip-state={check?.status ?? state}
          onPointerEnter={() => hover(cite.docId, cite.page)}
          onPointerLeave={() => hover(null)}
          onFocus={() => hover(cite.docId, cite.page)}
          onBlur={() => hover(null)}
          className={cn(
            "mx-0.5 inline-flex h-[1.45em] translate-y-[-0.08em] items-center gap-1 rounded-[5px] border px-1.5 align-middle font-mono text-[0.72em] leading-none font-medium whitespace-nowrap transition-[box-shadow,background-color] tabular",
            "hover:ring-2 hover:ring-verified/30 focus-visible:ring-2 focus-visible:ring-verified/40 data-[state=open]:ring-2 data-[state=open]:ring-verified/40",
            check ? VERDICT_STYLE[check.status] : state === "unverified" ? "border-dashed border-unsupported/60 text-unsupported-text" : "border-line-strong bg-surface-2 text-ink-muted",
          )}
        >
          {Icon ? <Icon aria-hidden className="size-[1.1em]" /> : state === "pending" ? <Spinner className="[&_svg]:size-[1em]" /> : null}
          <span aria-hidden>
            {label && <span className="mr-1 font-semibold">{label}</span>}
            {cite.page !== null ? `p.${cite.page}` : "doc"}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="z-[60] w-[min(360px,calc(100vw-24px))] rounded-lg border border-line bg-surface p-4 font-sans text-sm shadow-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 font-mono text-xs text-ink-subtle break-anywhere">
                {cite.docId}
                {cite.page !== null && ` · page ${cite.page}`}
              </p>
              <p className="m-0 mt-0.5 line-clamp-2 font-medium text-ink">{decodeEntities(title)}</p>
            </div>
            {check?.coverage != null && <CoverageRing value={check.coverage} status={check.status} />}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {check ? <CheckBadge status={check.status} className="self-start" /> : null}
            <p className="m-0 text-[13px] leading-relaxed text-ink-muted">{check ? describeCheck(check) : verdict + "."}</p>
            {check?.evidence && (
              <blockquote className="m-0 border-l-2 border-verified/60 pl-3 text-[13px] leading-relaxed text-ink break-anywhere">
                <span className="sr-only">Closest sentence on the page: </span>“{check.evidence}”
              </blockquote>
            )}
            {check && <p className="m-0 text-[11.5px] text-ink-subtle">Word overlap with the page, not proof of meaning.</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {source && (
              <Popover.Close asChild>
                <button type="button" onClick={showPassage} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink hover:bg-surface-3">
                  <ListTree aria-hidden className="size-4" /> Show passage
                </button>
              </Popover.Close>
            )}
            {cite.page !== null && (
              <Popover.Close asChild>
                <button type="button" onClick={viewPage} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-verified-text hover:bg-verified-wash">
                  <FileSearch aria-hidden className="size-4" /> View page {cite.page}
                </button>
              </Popover.Close>
            )}
          </div>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export const ChipGroup = React.memo(function ChipGroup({ group, refs }: { group: number; refs: [string, number | null][] }) {
  return (
    <span className="whitespace-nowrap">
      {refs.map(([docId, page], i) => (
        <CitationChip key={`${docId}:${page}:${i}`} group={group} index={i} cite={{ docId, page, raw: "" }} />
      ))}
    </span>
  );
});
