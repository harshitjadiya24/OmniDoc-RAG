"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, History, MessageSquarePlus, Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openChat, startNewChat } from "@/stores/actions";
import { useChats } from "@/stores/chats";
import { isBusy, useConversation } from "@/stores/conversation";

/** Current chat title, the history list, and New chat. Chats are stored on the server per user. */
export function ChatSwitcher() {
  const { chats, activeId, error } = useChats(useShallow((s) => ({ chats: s.chats, activeId: s.activeId, error: s.error })));
  const busy = useConversation((s) => isBusy(s.phase));
  const hasLive = useConversation((s) => s.phase !== "idle");
  const [open, setOpen] = React.useState(false);
  const active = chats.find((c) => c.id === activeId);
  const title = active?.title ?? "New chat";

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Chat history. Current: ${title}`}
            className="inline-flex h-9 max-w-[min(42vw,360px)] min-w-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink hover:bg-surface-3 data-[state=open]:bg-surface-3"
          >
            <History aria-hidden className="size-4 shrink-0 text-ink-muted" />
            <span className="min-w-0 truncate" data-truncated title={title}>
              {title}
            </span>
            <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={12} className="z-[60] flex max-h-[min(70dvh,520px)] w-[min(360px,calc(100vw-24px))] flex-col rounded-xl border border-line bg-surface shadow-panel">
            <p className="eyebrow m-0 border-b border-line px-4 py-3">Chats · {chats.length}</p>
            {error && <p className="m-0 px-4 py-2 text-xs text-unsupported-text">{error}</p>}
            {chats.length === 0 ? (
              <p className="m-0 px-4 py-6 text-center text-sm text-ink-muted">Answers you get are saved here automatically.</p>
            ) : (
              <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto overscroll-contain p-1.5" aria-label="Saved chats">
                {chats.map((c) => (
                  <li key={c.id} className="group flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      aria-current={c.id === activeId ? "true" : undefined}
                      onClick={() => {
                        setOpen(false);
                        void openChat(c.id);
                      }}
                      className={cn("flex min-h-11 min-w-0 flex-1 flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-surface-3 disabled:opacity-50", c.id === activeId && "bg-verified-wash")}
                    >
                      <span className="w-full truncate text-sm text-ink" title={c.title}>
                        {c.title}
                      </span>
                      <span className="text-[11px] text-ink-subtle">
                        {plural(c.message_count, "answer")} · {formatDate(c.updated_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete chat: ${c.title}`}
                      onClick={() => void useChats.getState().remove(c.id)}
                      className="grid size-9 shrink-0 place-items-center rounded-md text-ink-subtle opacity-60 transition-opacity group-hover:opacity-100 hover:bg-unsupported-wash hover:text-unsupported-text focus-visible:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Button variant="ghost" size="sm" onClick={startNewChat} disabled={busy || (!activeId && !hasLive)} aria-label="New chat">
        <MessageSquarePlus /> <span className="hidden sm:inline">New</span>
      </Button>
    </div>
  );
}
