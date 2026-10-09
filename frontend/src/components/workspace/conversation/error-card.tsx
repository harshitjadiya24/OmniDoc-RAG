import { RotateCcw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TurnError } from "@/stores/conversation";

const TITLE: Record<TurnError["kind"], string> = {
  network: "Couldn’t reach the API",
  http: "The request was refused",
  content_type: "Unexpected response",
  early_close: "The answer was cut short",
  idle_timeout: "The answer stalled",
  model: "The answer model failed",
};

export function ErrorCard({ error, hasPartial, onRetry }: { error: TurnError; hasPartial: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-w-0 items-start gap-3 rounded-lg border border-unsupported/35 bg-unsupported-wash p-4">
      <Unplug aria-hidden className="mt-0.5 size-5 shrink-0 text-unsupported-text" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium text-ink">{TITLE[error.kind]}</p>
        <p className="m-0 mt-1 text-sm leading-relaxed text-ink-muted break-anywhere">{error.message}</p>
        {hasPartial && <p className="m-0 mt-1 text-xs text-ink-subtle">The partial answer above was not page-checked.</p>}
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCcw /> Ask again
        </Button>
      </div>
    </div>
  );
}
