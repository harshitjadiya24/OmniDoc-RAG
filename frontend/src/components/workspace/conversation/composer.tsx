"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { isBusy, useConversation } from "@/stores/conversation";
import { askBlocker, useLibrary } from "@/stores/library";
import { SettingsPopover } from "./settings-popover";

export const COMPOSER_ID = "composer-input";

export function Composer() {
  const { draft, phase, setDraft, submit, stop } = useConversation(
    useShallow((s) => ({ draft: s.draft, phase: s.phase, setDraft: s.setDraft, submit: s.submit, stop: s.stop })),
  );
  const library = useLibrary(useShallow((s) => ({ documents: s.documents, selectedIds: s.selectedIds, task: s.task })));
  const blocker = askBlocker(library);
  const busy = isBusy(phase);
  const tooShort = draft.trim().length < 3;
  const scope =
    library.task === "compare" ? "Comparing two documents" : library.selectedIds.length ? `Asking ${plural(library.selectedIds.length, "document")}` : null;

  const send = () => {
    if (!busy && !blocker && !tooShort) void submit();
  };

  return (
    <form
      className="glow-ring flex min-w-0 flex-col rounded-xl border border-line-strong bg-surface shadow-panel"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor={COMPOSER_ID} className="sr-only">
        Ask a question about your documents
      </label>
      <textarea
        id={COMPOSER_ID}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          } else if (e.key === "Escape" && busy) {
            stop();
          }
        }}
        maxLength={2000}
        rows={1}
        placeholder={library.task === "compare" ? "What changed between these two documents?" : "Ask anything the documents can answer…"}
        aria-describedby="composer-hint"
        className="max-h-[40dvh] min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed text-ink [field-sizing:content] placeholder:text-ink-subtle focus:outline-none"
      />
      <div className="flex min-w-0 items-center justify-between gap-2 px-2 pt-1 pb-2">
        <div className="flex min-w-0 items-center gap-1">
          <SettingsPopover />
          <p id="composer-hint" className="m-0 min-w-0 truncate pl-1 text-xs text-ink-subtle" aria-live="polite">
            {blocker ?? scope}
            <span className="hidden md:inline"> · Enter to send, Shift+Enter for a new line</span>
          </p>
        </div>
        {busy ? (
          <Button type="button" variant="inverse" size="sm" onClick={stop} aria-label="Stop answering">
            <Square className="!size-3 fill-current" /> Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" size="sm" disabled={!!blocker || tooShort} aria-label="Ask">
            <ArrowUp /> Ask
          </Button>
        )}
      </div>
    </form>
  );
}
