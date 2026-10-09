"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { listProviders } from "@/lib/api/auth";
import type { ProviderInfo, RetrievalMode } from "@/lib/api/schemas";
import { useSettings } from "@/stores/settings";

const MODES: { value: RetrievalMode; label: string }[] = [
  { value: "hybrid", label: "Hybrid" },
  { value: "dense", label: "Dense" },
  { value: "bm25", label: "BM25" },
];

const MODE_HINT: Record<RetrievalMode, string> = {
  hybrid: "Keywords and meaning, fused with reciprocal rank fusion. Best default.",
  dense: "Meaning only (bge-small embeddings). Misses exact IDs and numbers.",
  bm25: "Exact keywords only. Misses paraphrases.",
};

function useProviders() {
  const [state, setState] = React.useState<{ default: string; providers: ProviderInfo[] } | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    const ctrl = new AbortController();
    listProviders(ctrl.signal)
      .then(setState)
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true);
      });
    return () => ctrl.abort();
  }, []);
  return { state, failed };
}

/** Retrieval and model options for the next question. */
export function SettingsPopover() {
  const { mode, rerank, rewrite, provider, set } = useSettings();
  const [open, setOpen] = React.useState(false);
  const changed = mode !== "hybrid" || !rerank || rewrite || provider !== null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Answer settings: ${mode}${rerank ? ", rerank on" : ""}${rewrite ? ", rewrite on" : ""}`}
          className="relative inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink data-[state=open]:bg-surface-3 data-[state=open]:text-ink"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          <span className="hidden font-mono text-xs sm:inline">{mode}{rerank ? " · rerank" : ""}</span>
          {changed && <span aria-hidden className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-verified sm:hidden" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="start" sideOffset={10} collisionPadding={12} className="z-[60] w-[min(380px,calc(100vw-24px))] rounded-xl border border-line bg-surface p-4 shadow-panel">
          {open && <Panel mode={mode} rerank={rerank} rewrite={rewrite} provider={provider} set={set} />}
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Panel({ mode, rerank, rewrite, provider, set }: Omit<ReturnType<typeof useSettings.getState>, "reset">) {
  const { state, failed } = useProviders();
  const current = provider ?? state?.default ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="eyebrow m-0">Retrieval</p>
        <Segmented label="Retrieval mode" layoutId="settings-mode" items={MODES} value={mode} onChange={(m) => set({ mode: m })} size="sm" className="w-full" />
        <p className="m-0 text-xs text-ink-subtle">{MODE_HINT[mode]}</p>
      </div>
      <div className="flex flex-col divide-y divide-line border-y border-line">
        <Switch id="opt-rerank" label="Rerank" hint="Cross-encoder re-scores the candidates. About a second slower." checked={rerank} onCheckedChange={(v) => set({ rerank: v })} />
        <Switch
          id="opt-rewrite"
          label="Query rewrite"
          hint={mode === "dense" ? "Only affects keyword search, so it is skipped in Dense mode." : "Adds model-suggested keywords to the keyword search. A few seconds slower."}
          checked={rewrite}
          disabled={mode === "dense"}
          onCheckedChange={(v) => set({ rewrite: v })}
        />
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="eyebrow mb-2 p-0">Answer model</legend>
        {failed && <p className="m-0 text-xs text-unsupported-text">Couldn’t load the model list. The server default is used.</p>}
        {!state && !failed && <p className="m-0 text-xs text-ink-subtle">Checking which models are available…</p>}
        {state?.providers.map((p) => (
          <label
            key={p.id}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-2.5 has-[:checked]:border-verified/50 has-[:checked]:bg-verified-wash has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
          >
            <input type="radio" name="provider" className="mt-1 accent-[var(--verified-fill)]" checked={current === p.id} disabled={!p.available} onChange={() => set({ provider: p.id })} />
            <span className="min-w-0">
              <span className="block text-sm text-ink">
                {p.label} <span className="font-mono text-xs text-ink-subtle">{p.model}</span>
              </span>
              <span className="block text-xs text-ink-subtle">{p.available ? (p.local ? "Runs on this machine. Nothing leaves it." : "Sends passages to the provider.") : p.reason}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
