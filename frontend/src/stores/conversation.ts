import { create } from "zustand";
import {
  STAGES,
  type CitationCheck,
  type Plan,
  type Refusal,
  type Source,
  type StageName,
  type StreamEvent,
  type Usage,
} from "@/lib/api/schemas";
import { streamAsk, type StreamErrorKind } from "@/lib/api/stream";
import { assignChecks } from "@/lib/rag/checks";
import { useChats } from "./chats";
import { askBlocker, useLibrary } from "./library";
import { useSettings } from "./settings";

export type Phase = "idle" | "submitting" | "streaming" | "complete" | "refused" | "error" | "aborted";
export type StageStatus = "pending" | "active" | "done";
export type Stage = { id: StageName; status: StageStatus; startedAt: number | null; endedAt: number | null };
export type TurnError = { message: string; kind: StreamErrorKind | "model" };

/** The live question/answer turn. Finished turns are persisted by the chats store. */
type LiveTurn = {
  question: string;
  phase: Phase;
  stages: Stage[];
  plan: Plan | null;
  sources: Source[] | null;
  answer: string;
  /** Count of token events. Shown as "stream chunks", never as tokens. */
  chunks: number;
  checks: CitationCheck[] | null;
  checkByChip: Record<string, CitationCheck>;
  usage: Usage | null;
  refusal: Refusal | null;
  error: TurnError | null;
  startedAt: number | null;
  /** Saved chat message for this turn once persisted, so the transcript does not show it twice. */
  savedId: string | null;
};

type ConversationState = LiveTurn & {
  draft: string;
  controller: AbortController | null;
  setDraft: (draft: string) => void;
  submit: (question?: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  apply: (event: StreamEvent) => void;
};

const freshStages = (): Stage[] => STAGES.map((id) => ({ id, status: "pending", startedAt: null, endedAt: null }));

const EMPTY_TURN: LiveTurn = {
  question: "",
  phase: "idle",
  stages: freshStages(),
  plan: null,
  sources: null,
  answer: "",
  chunks: 0,
  checks: null,
  checkByChip: {},
  usage: null,
  refusal: null,
  error: null,
  startedAt: null,
  savedId: null,
};

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

/**
 * Stages only move forward: when a stage starts, every earlier one is done.
 * Repeated, unknown or out-of-order stage events never move the stepper back.
 */
export function advanceStages(stages: Stage[], name: string, at = now()): Stage[] {
  const idx = stages.findIndex((s) => s.id === name);
  if (idx === -1 || stages[idx].status === "done") return stages;
  return stages.map((s, i) => {
    if (i < idx && s.status !== "done") return { ...s, status: "done", startedAt: s.startedAt ?? at, endedAt: s.endedAt ?? at };
    if (i === idx && s.status === "pending") return { ...s, status: "active", startedAt: at };
    return s;
  });
}

export function finishStages(stages: Stage[], at = now()): Stage[] {
  return stages.map((s) => (s.status === "done" ? s : { ...s, status: "done", startedAt: s.startedAt ?? at, endedAt: at }));
}

export const isBusy = (phase: Phase) => phase === "submitting" || phase === "streaming";

export const useConversation = create<ConversationState>((set, get) => ({
  ...EMPTY_TURN,
  draft: "",
  controller: null,

  setDraft: (draft) => set({ draft }),

  clear: () => {
    get().controller?.abort();
    set({ ...EMPTY_TURN, stages: freshStages(), controller: null });
  },

  stop: () => {
    const { controller, phase } = get();
    if (!isBusy(phase)) return;
    controller?.abort();
    set({ phase: "aborted", controller: null, stages: get().stages.map((s) => (s.status === "active" ? { ...s, status: "pending" } : s)) });
  },

  apply: (event) => {
    const s = get();
    switch (event.type) {
      case "stage":
        set({ stages: advanceStages(s.stages, event.name), phase: "streaming" });
        return;
      case "plan":
        set({ plan: event });
        return;
      case "sources":
        set({ sources: event.items });
        return;
      case "token":
        set({ answer: s.answer + event.text, chunks: s.chunks + 1, phase: "streaming" });
        return;
      case "error":
        set({ phase: "error", error: { message: event.message, kind: "model" }, controller: null });
        return;
      case "done": {
        const checks = event.citations ?? null;
        set({
          stages: finishStages(s.stages),
          phase: event.refused ? "refused" : "complete",
          refusal: event.refused ? (event.refusal ?? null) : null,
          checks,
          checkByChip: checks ? assignChecks(s.answer, checks) : {},
          usage: event.usage,
          controller: null,
        });
        const turn = { question: s.question, answer: s.answer, refused: event.refused, sources: s.sources ?? [], citations: checks ?? [] };
        void useChats
          .getState()
          .record(turn)
          .then((saved) => {
            if (saved && get().question === turn.question && get().answer === turn.answer) set({ savedId: saved.id });
          });
        return;
      }
    }
  },

  submit: async (override) => {
    const question = (override ?? get().draft).trim();
    const library = useLibrary.getState();
    if (question.length < 3 || askBlocker(library)) return;

    get().controller?.abort();
    const controller = new AbortController();
    const settings = useSettings.getState();
    set({ ...EMPTY_TURN, stages: freshStages(), question, draft: "", phase: "submitting", startedAt: now(), controller });

    await streamAsk(
      {
        question,
        mode: settings.mode,
        rerank: settings.rerank,
        rewrite: settings.rewrite,
        document_ids: library.selectedIds,
        task: library.task,
        ...(settings.provider ? { provider: settings.provider } : {}),
        chat_id: useChats.getState().activeId,
      },
      {
        signal: controller.signal,
        onEvent: (event) => {
          if (get().controller === controller) get().apply(event);
        },
        onError: (error) => {
          if (get().controller !== controller || get().phase === "error") return;
          set({ phase: "error", error: { message: error.message, kind: error.kind }, controller: null });
        },
      },
    );
  },
}));
