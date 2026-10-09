import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ProviderId, RetrievalMode } from "@/lib/api/schemas";

export type Settings = {
  mode: RetrievalMode;
  rerank: boolean;
  /** Ask the model for extra BM25 keywords first. */
  rewrite: boolean;
  /** Answer model; null uses the server default. */
  provider: ProviderId | null;
};

export const DEFAULT_SETTINGS: Settings = { mode: "hybrid", rerank: true, rewrite: false, provider: null };

/** Keeps only well-formed persisted fields; anything stale or corrupt falls back to defaults. */
export function sanitizeSettings(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (r.mode === "dense" || r.mode === "bm25" || r.mode === "hybrid") out.mode = r.mode;
  if (typeof r.rerank === "boolean") out.rerank = r.rerank;
  if (typeof r.rewrite === "boolean") out.rewrite = r.rewrite;
  if (r.provider === "ollama" || r.provider === "gemini" || r.provider === null) out.provider = r.provider;
  return out;
}

type SettingsStore = Settings & { set: (patch: Partial<Settings>) => void; reset: () => void };

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "omnidoc-settings",
      version: 1,
      storage: safeStorage,
      partialize: ({ mode, rerank, rewrite, provider }) => ({ mode, rerank, rewrite, provider }),
      migrate: () => ({}),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
);
