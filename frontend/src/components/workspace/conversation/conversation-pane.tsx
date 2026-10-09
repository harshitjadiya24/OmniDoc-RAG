"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { useScrollEdges } from "@/hooks/use-scroll-edges";
import { cn } from "@/lib/utils";
import { useChats } from "@/stores/chats";
import { useConversation } from "@/stores/conversation";
import { Announcer } from "./announcer";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { LiveTurn, SavedTurn } from "./turn";

/** The thread: saved turns of the open chat, the live turn, and the composer docked below. */
export function ConversationPane({ toolbar }: { toolbar: React.ReactNode }) {
  const transcript = useChats((s) => s.transcript);
  const { phase, savedId, answerLength } = useConversation(useShallow((s) => ({ phase: s.phase, savedId: s.savedId, answerLength: s.answer.length })));
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const followRef = React.useRef(true);
  const { top } = useScrollEdges(scrollRef);
  const past = transcript.filter((m) => m.id !== savedId);
  const empty = past.length === 0 && phase === "idle";

  // Follow the stream only while the reader is at the bottom; never fight a scroll up.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && followRef.current) el.scrollTop = el.scrollHeight;
  }, [answerLength, phase, past.length]);

  return (
    <section aria-labelledby="workspace-title" className="flex min-h-0 min-w-0 flex-col">
      <h1 id="workspace-title" className="sr-only">
        Workspace
      </h1>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5 empty:hidden">{toolbar}</div>
      <div className="relative min-h-0 flex-1">
        <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-black/15 to-transparent opacity-0 transition-opacity dark:from-black/50", top && "opacity-100")} />
        <div ref={scrollRef} role="region" aria-label="Conversation" tabIndex={0} className="h-full overflow-y-auto overscroll-contain px-[clamp(1rem,3vw,2.5rem)] focus-visible:outline-offset-[-2px]">
          {empty ? (
            <EmptyState />
          ) : (
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-10 py-8">
              {past.map((m) => (
                <SavedTurn key={m.id} message={m} />
              ))}
              <LiveTurn />
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 px-[clamp(0.75rem,3vw,2.5rem)] pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[760px]">
          <Composer />
        </div>
      </div>
      <Announcer />
    </section>
  );
}
