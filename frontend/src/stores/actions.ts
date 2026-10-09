import { useChats } from "./chats";
import { useConversation } from "./conversation";
import { useEvidence } from "./evidence";

/** Workspace actions that touch several stores. */
export function startNewChat(): void {
  useConversation.getState().clear();
  useChats.getState().newChat();
  useEvidence.getState().focusTurn({ kind: "live" });
}

export async function openChat(id: string): Promise<void> {
  useConversation.getState().clear();
  await useChats.getState().open(id);
  const last = useChats.getState().transcript.at(-1);
  useEvidence.getState().focusTurn(last ? { kind: "message", id: last.id } : { kind: "live" });
}

export function focusComposer(): void {
  document.getElementById("composer-input")?.focus();
}
