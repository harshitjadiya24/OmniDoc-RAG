import { create } from "zustand";

/** Layout state of the workspace that several components need. */
type UiState = {
  librarySheet: boolean;
  setLibrarySheet: (open: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  librarySheet: false,
  setLibrarySheet: (librarySheet) => set({ librarySheet }),
}));
