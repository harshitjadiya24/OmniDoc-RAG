import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { deleteDocument, isPdf, listDocuments, updateDocument, uploadDocument } from "@/lib/api/documents";
import type { DocumentPatch, LibraryDocument, Task } from "@/lib/api/schemas";

export type Upload = { key: string; name: string; status: "uploading" | "error"; stage: string | null; error: string | null };

type LibraryState = {
  documents: LibraryDocument[];
  selectedIds: string[];
  task: Task;
  uploads: Upload[];
  loaded: boolean;
  error: string | null;
  /** Document whose details drawer is open. */
  openId: string | null;
  load: () => Promise<void>;
  upload: (files: File[]) => Promise<void>;
  remove: (id: string) => Promise<string | null>;
  update: (id: string, patch: DocumentPatch) => Promise<string | null>;
  toggle: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  setTask: (task: Task) => void;
  setOpen: (id: string | null) => void;
  dismissUpload: (key: string) => void;
};

let counter = 0;
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "The request failed unexpectedly.");

export const useLibrary = create<LibraryState>((set, get) => ({
  documents: [],
  selectedIds: [],
  task: "ask",
  uploads: [],
  loaded: false,
  error: null,
  openId: null,

  load: async () => {
    try {
      const documents = await listDocuments();
      const known = new Set(documents.map((d) => d.id));
      // First load selects everything; later loads keep the user's selection.
      const selectedIds = get().loaded ? get().selectedIds.filter((id) => known.has(id)) : documents.map((d) => d.id);
      set({ documents, selectedIds, loaded: true, error: null });
    } catch (e) {
      set({ error: messageOf(e), loaded: true });
    }
  },

  upload: async (files) => {
    await Promise.all(
      files.map(async (file) => {
        const key = `upload-${++counter}`;
        if (!isPdf(file)) {
          set((s) => ({ uploads: [...s.uploads, { key, name: file.name, status: "error", stage: null, error: "Only PDF files can be uploaded." }] }));
          return;
        }
        set((s) => ({ uploads: [...s.uploads, { key, name: file.name, status: "uploading", stage: "Uploading", error: null }] }));
        try {
          const doc = await uploadDocument(file, (stage) => set((s) => ({ uploads: s.uploads.map((u) => (u.key === key ? { ...u, stage } : u)) })));
          set((s) => ({
            uploads: s.uploads.filter((u) => u.key !== key),
            documents: s.documents.some((d) => d.id === doc.id) ? s.documents.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...s.documents],
            selectedIds: s.selectedIds.includes(doc.id) ? s.selectedIds : [...s.selectedIds, doc.id],
          }));
        } catch (e) {
          set((s) => ({ uploads: s.uploads.map((u) => (u.key === key ? { ...u, status: "error", error: messageOf(e) } : u)) }));
        }
      }),
    );
  },

  remove: async (id) => {
    try {
      await deleteDocument(id);
      set((s) => ({
        documents: s.documents.filter((d) => d.id !== id),
        selectedIds: s.selectedIds.filter((x) => x !== id),
        openId: s.openId === id ? null : s.openId,
      }));
      // Other documents' statuses can depend on this one (supersedes edges).
      await get().load();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  },

  update: async (id, patch) => {
    try {
      await updateDocument(id, patch);
      await get().load();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  },

  toggle: (id) => set((s) => ({ selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] })),
  selectAll: () => set((s) => ({ selectedIds: s.documents.map((d) => d.id) })),
  selectNone: () => set({ selectedIds: [] }),
  setTask: (task) => set({ task }),
  setOpen: (openId) => set({ openId }),
  dismissUpload: (key) => set((s) => ({ uploads: s.uploads.filter((u) => u.key !== key) })),
}));

/** Why the composer cannot send right now, or null when it can. */
export function askBlocker(state: Pick<LibraryState, "documents" | "selectedIds" | "task">): string | null {
  if (state.documents.length === 0) return "Upload a PDF to start asking.";
  if (state.selectedIds.length === 0) return "Select at least one document.";
  if (state.task === "compare" && state.selectedIds.length !== 2) return "Compare needs exactly two documents selected.";
  return null;
}
