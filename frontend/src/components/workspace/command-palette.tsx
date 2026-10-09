"use client";

import { Command } from "cmdk";
import { useTheme } from "next-themes";
import { FileText, History, Library, MessageSquarePlus, MessageSquareText, MoonStar, PanelRight, PenLine, Upload } from "lucide-react";
import { decodeEntities } from "@/lib/format";
import { focusComposer, openChat, startNewChat } from "@/stores/actions";
import { useChats } from "@/stores/chats";
import { useConversation } from "@/stores/conversation";
import { useEvidence } from "@/stores/evidence";
import { useLibrary } from "@/stores/library";
import { useUi } from "@/stores/ui";

export const UPLOAD_INPUT_ID = "palette-upload";

const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-ink data-[selected=true]:bg-surface-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle";
const GROUP = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-ink-subtle [&_[cmdk-group-heading]]:uppercase";

/** ⌘K: every workspace action, your chats, documents and their suggested questions. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const chats = useChats((s) => s.chats);
  const documents = useLibrary((s) => s.documents);
  // Run after the dialog has closed and restored focus, so actions that move focus keep it.
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    setTimeout(fn, 80);
  };
  const questions = documents.flatMap((d) => d.example_questions.slice(0, 2).map((q) => ({ q, id: d.id }))).slice(0, 6);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
      contentClassName="fixed top-[12dvh] left-1/2 z-50 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-panel"
    >
      <Command.Input placeholder="Search actions, chats and documents…" className="h-14 w-full border-b border-line bg-transparent px-4 text-[15px] text-ink placeholder:text-ink-subtle focus:outline-none" />
      <Command.List className="max-h-[min(60dvh,440px)] overflow-y-auto overscroll-contain p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-ink-muted">Nothing matches.</Command.Empty>
        <Command.Group heading="Actions" className={GROUP}>
          <Command.Item className={ITEM} onSelect={run(focusComposer)}>
            <PenLine /> Ask a question
          </Command.Item>
          <Command.Item className={ITEM} onSelect={run(startNewChat)}>
            <MessageSquarePlus /> New chat
          </Command.Item>
          <Command.Item className={ITEM} onSelect={run(() => document.getElementById(UPLOAD_INPUT_ID)?.click())}>
            <Upload /> Upload PDFs
          </Command.Item>
          <Command.Item className={ITEM} onSelect={run(() => useUi.getState().setLibrarySheet(true))}>
            <Library /> Open library
          </Command.Item>
          <Command.Item className={ITEM} onSelect={run(() => useEvidence.getState().setSheetOpen(true))}>
            <PanelRight /> Open evidence
          </Command.Item>
          <Command.Item className={ITEM} onSelect={run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
            <MoonStar /> Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
          </Command.Item>
        </Command.Group>
        {questions.length > 0 && (
          <Command.Group heading="Suggested questions" className={GROUP}>
            {questions.map(({ q, id }) => (
              <Command.Item key={`${id}:${q}`} value={`ask ${q}`} className={ITEM} onSelect={run(() => void useConversation.getState().submit(q))}>
                <MessageSquareText /> <span className="min-w-0 truncate">{q}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {chats.length > 0 && (
          <Command.Group heading="Chats" className={GROUP}>
            {chats.slice(0, 8).map((c) => (
              <Command.Item key={c.id} value={`chat ${c.title} ${c.id}`} className={ITEM} onSelect={run(() => void openChat(c.id))}>
                <History /> <span className="min-w-0 truncate">{c.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {documents.length > 0 && (
          <Command.Group heading="Documents" className={GROUP}>
            {documents.map((d) => (
              <Command.Item key={d.id} value={`doc ${d.title} ${d.id}`} className={ITEM} onSelect={run(() => useLibrary.getState().setOpen(d.id))}>
                <FileText /> <span className="min-w-0 truncate">{decodeEntities(d.title)}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-subtle">{d.id}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
