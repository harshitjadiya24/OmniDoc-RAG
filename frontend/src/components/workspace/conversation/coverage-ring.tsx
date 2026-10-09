import type { CheckStatus } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

const STROKE: Record<CheckStatus, string> = {
  supported: "stroke-verified",
  partial: "stroke-partial",
  unsupported: "stroke-unsupported",
  not_found: "stroke-neutral",
  unchecked: "stroke-neutral",
};

/** Share of the statement's key words found on the cited page, as a ring with the number inside. */
export function CoverageRing({ value, status, size = 44 }: { value: number; status: CheckStatus; size?: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${pct}% word coverage`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} className="fill-none stroke-line-strong" strokeWidth="3.5" />
        <circle cx="20" cy="20" r={r} className={cn("fill-none transition-[stroke-dashoffset] duration-700", STROKE[status])} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span aria-hidden className="font-mono text-[11px] font-semibold text-ink tabular">{pct}</span>
    </span>
  );
}
