import { Info } from "lucide-react";
import type { Refusal } from "@/lib/api/schemas";

const DEFAULT: Refusal = {
  title: "The documents don’t answer this.",
  message: "Nothing in the selected documents supports an answer, so none was written. Try rephrasing, or select more documents.",
  suggestions: [],
};

/** A calm refusal: the system declining to guess is the product working, not an error. */
export function RefusalCard({ refusal, onSuggest, disabled }: { refusal: Refusal | null; onSuggest: (q: string) => void; disabled: boolean }) {
  const r = refusal ?? DEFAULT;
  return (
    <div className="relative min-w-0 overflow-hidden rounded-lg border border-line bg-surface-2 p-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-neutral" />
      <div className="flex min-w-0 items-start gap-3">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-neutral-text" />
        <div className="min-w-0">
          <p className="m-0 font-medium text-ink">{r.title}</p>
          <p className="m-0 mt-1 text-sm leading-relaxed text-ink-muted">{r.message}</p>
          <p className="m-0 mt-2 text-xs text-ink-subtle">Refusing is deliberate: an answer is only written when the passages support it.</p>
          {r.suggestions.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0" aria-label="Try instead">
              {r.suggestions.map((s) => (
                <li key={s} className="min-w-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSuggest(s)}
                    className="min-h-9 max-w-full rounded-full border border-line-strong bg-surface px-3 py-1.5 text-left text-[13px] text-ink transition-colors hover:border-verified/50 hover:bg-verified-wash disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
