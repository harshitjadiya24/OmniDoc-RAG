import { create } from "zustand";
import { addMessage, createChat, deleteChat, getChat, listChats, type NewTurn } from "@/lib/api/chats";
import type { Chat, ChatMessage } from "@/lib/api/schemas";

type ChatsState = {
  chats: Chat[];
  activeId: string | null;
  /** Persisted turns of the open chat, oldest first. */
  transcript: ChatMessage[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  newChat: () => void;
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Persists a finished turn to the active chat (created on first use). Resolves to the saved message, or null. */
  record: (turn: NewTurn) => Promise<ChatMessage | null>;
};

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "The request failed.");

export const useChats = create<ChatsState>((set, get) => ({
  chats: [],
  activeId: null,
  transcript: [],
  loaded: false,
  error: null,

  load: async () => {
    try {
      set({ chats: await listChats(), loaded: true, error: null });
    } catch (e) {
      set({ error: messageOf(e), loaded: true });
    }
  },

  newChat: () => set({ activeId: null, transcript: [] }),

  open: async (id) => {
    try {
      const chat = await getChat(id);
      set({ activeId: chat.id, transcript: chat.messages, error: null });
    } catch (e) {
      set({ error: messageOf(e) });
    }
  },

  remove: async (id) => {
    try {
      await deleteChat(id);
      set((s) => ({ chats: s.chats.filter((c) => c.id !== id), ...(s.activeId === id ? { activeId: null, transcript: [] } : {}) }));
    } catch (e) {
      set({ error: messageOf(e) });
    }
  },

  record: async (turn) => {
    try {
      let id = get().activeId;
      if (!id) {
        id = (await createChat()).id;
        set({ activeId: id });
      }
      const message = await addMessage(id, turn);
      set((s) => ({ transcript: [...s.transcript, message] }));
      void get().load();
      return message;
    } catch (e) {
      // History is a convenience: failing to save must not break the answer the user just received.
      set({ error: messageOf(e) });
      return null;
    }
  },
}));
