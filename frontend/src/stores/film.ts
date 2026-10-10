import { create } from "zustand";

/** Opens the full-screen film on request (e.g. "Watch with sound"); the first-visit intro opens itself. */
type FilmState = { requested: number; request: () => void };

export const useFilm = create<FilmState>((set) => ({
  requested: 0,
  request: () => set((s) => ({ requested: s.requested + 1 })),
}));
