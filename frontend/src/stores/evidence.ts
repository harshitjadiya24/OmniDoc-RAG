import { create } from "zustand";

/** Which turn the evidence pane shows: the live one, or a saved chat message. */
export type EvidenceFocus = { kind: "live" } | { kind: "message"; id: string };

export type PdfTarget = { docId: string; page: number; title: string; passage: string | null; evidence: string | null };

type EvidenceState = {
  focus: EvidenceFocus;
  /** Passage expanded in the list (sourceKey). */
  selected: string | null;
  /** Document ID highlighted while a citation chip is hovered or focused. */
  hoveredDoc: string | null;
  hoveredPage: number | null;
  pdf: PdfTarget | null;
  /** Mobile and tablet: the evidence sheet. */
  sheetOpen: boolean;
  focusTurn: (focus: EvidenceFocus, selected?: string | null) => void;
  select: (key: string | null) => void;
  hover: (docId: string | null, page?: number | null) => void;
  openPdf: (target: PdfTarget | null) => void;
  setSheetOpen: (open: boolean) => void;
};

export const useEvidence = create<EvidenceState>((set) => ({
  focus: { kind: "live" },
  selected: null,
  hoveredDoc: null,
  hoveredPage: null,
  pdf: null,
  sheetOpen: false,
  focusTurn: (focus, selected = null) => set({ focus, selected }),
  select: (selected) => set({ selected }),
  hover: (hoveredDoc, hoveredPage = null) => set({ hoveredDoc, hoveredPage }),
  openPdf: (pdf) => set({ pdf }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
}));
