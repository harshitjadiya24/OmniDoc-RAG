import { z } from "zod";
import { enc, failure, getJson, request, sendJson } from "./client";
import { ChatMessageSchema, ChatSchema, type Chat, type ChatMessage, type CitationCheck, type Source } from "./schemas";

export function listChats(signal?: AbortSignal): Promise<Chat[]> {
  return getJson("/chats", z.array(ChatSchema), { signal });
}

export function createChat(): Promise<Chat> {
  return getJson("/chats", ChatSchema, { method: "POST" });
}

export function getChat(id: string): Promise<Chat> {
  return getJson(`/chats/${enc(id)}`, ChatSchema);
}

export async function deleteChat(id: string): Promise<void> {
  const res = await request(`/chats/${enc(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await failure(res);
}

export type NewTurn = { question: string; answer: string; refused: boolean; sources: Source[]; citations: CitationCheck[] };

export function addMessage(chatId: string, turn: NewTurn): Promise<ChatMessage> {
  return sendJson(`/chats/${enc(chatId)}/messages`, "POST", turn, ChatMessageSchema);
}
