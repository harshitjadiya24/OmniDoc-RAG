"use client";

import * as React from "react";
import type { CitationCheck, Source } from "@/lib/api/schemas";
import type { EvidenceFocus } from "@/stores/evidence";

export type TurnData = {
  focus: EvidenceFocus;
  sources: Source[] | null;
  checkByChip: Record<string, CitationCheck>;
  /** Short labels per document ("A", "B"…) when more than one document contributed. */
  docLabels: Record<string, string>;
  /** Document titles by ID, for accessible names. */
  titles: Record<string, string>;
};

const TurnContext = React.createContext<TurnData | null>(null);

export const TurnProvider = TurnContext.Provider;

export function useTurn(): TurnData {
  const ctx = React.useContext(TurnContext);
  if (!ctx) throw new Error("useTurn must be used inside a TurnProvider");
  return ctx;
}

/** Labels A, B, C… in the order documents first appear among the sources. Empty for a single document. */
export function labelDocuments(sources: Source[] | null, compareOrder?: string[]): Record<string, string> {
  const ids = compareOrder?.length ? compareOrder : Array.from(new Set((sources ?? []).map((s) => s.circular_id.toUpperCase())));
  if (ids.length < 2) return {};
  return Object.fromEntries(ids.map((id, i) => [id.toUpperCase(), String.fromCharCode(65 + (i % 26))]));
}
