import { Columns2, FileStack, TriangleAlert } from "lucide-react";
import type { Plan } from "@/lib/api/schemas";
import { decodeEntities, plural } from "@/lib/format";

/** How the backend decided to answer. Routing is never invisible. */
export function PlanBanner({ plan }: { plan: Plan }) {
  if (plan.mode === "single") return null;
  const silent = plan.documents.filter((d) => !plan.contributing.includes(d.id));
  const Icon = plan.mode === "compare" ? Columns2 : FileStack;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="m-0 flex min-w-0 items-start gap-2 text-[13px] text-ink">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-verified-text" />
        <span className="min-w-0">
          <span className="font-medium">{plan.mode === "compare" ? "Comparison" : "Searched each document separately"}.</span>{" "}
          <span className="text-ink-muted">{plan.reason}</span>
        </span>
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {plan.documents.map((d) => (
          <li key={d.id} className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs">
            {d.label && <span className="grid size-4 shrink-0 place-items-center rounded-[3px] bg-inverse font-mono text-[10px] font-semibold text-on-inverse">{d.label}</span>}
            <span className="min-w-0 truncate text-ink" title={decodeEntities(d.title)}>
              {decodeEntities(d.title)}
            </span>
            <span className="shrink-0 font-mono text-ink-subtle tabular">{plural(d.passages, "passage")}</span>
          </li>
        ))}
      </ul>
      {silent.length > 0 && (
        <p className="m-0 flex items-start gap-2 text-xs text-partial-text">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {silent.map((d) => decodeEntities(d.title)).join(", ")} contributed no passages, so the answer cannot speak for {silent.length === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}
