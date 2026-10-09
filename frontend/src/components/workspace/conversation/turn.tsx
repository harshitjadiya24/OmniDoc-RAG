"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { ChevronDown } from "lucide-react";
import type { ChatMessage, Source } from "@/lib/api/schemas";
import { useFrameSelector } from "@/hooks/use-frame-selector";
import { assignChecks } from "@/lib/rag/checks";
import { decodeEntities, formatMs } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { isBusy, useConversation } from "@/stores/conversation";
import { useEvidence } from "@/stores/evidence";
import { useLibrary } from "@/stores/library";
import { AnswerMeta } from "./answer-meta";
import { AnswerText } from "./answer-text";
import { ErrorCard } from "./error-card";
import { PipelineStepper } from "./pipeline-stepper";
import { PlanBanner } from "./plan-banner";
import { RefusalCard } from "./refusal-card";
import { labelDocuments, TurnProvider, type TurnData } from "./turn-context";

function Question({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="m-0 max-w-[min(90%,640px)] rounded-xl rounded-br-sm bg-inverse px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-on-inverse break-anywhere">
        <span className="sr-only">You asked: </span>
        {text}
      </p>
    </div>
  );
}

function useTitles(sources: Source[] | null): Record<string, string> {
  const documents = useLibrary((s) => s.documents);
  return React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const d of documents) out[d.id.toUpperCase()] = d.title;
    for (const s of sources ?? []) out[s.circular_id.toUpperCase()] ??= s.title;
    return out;
  }, [documents, sources]);
}

const selectAnswer = (s: ReturnType<typeof useConversation.getState>) => s.answer;
const selectChunks = (s: ReturnType<typeof useConversation.getState>) => s.chunks;

/** The question being answered right now, streaming. */
export function LiveTurn() {
  const { question, phase, stages, plan, sources, checks, checkByChip, usage, refusal, error } = useConversation(
    useShallow((s) => ({ question: s.question, phase: s.phase, stages: s.stages, plan: s.plan, sources: s.sources, checks: s.checks, checkByChip: s.checkByChip, usage: s.usage, refusal: s.refusal, error: s.error })),
  );
  const answer = useFrameSelector(selectAnswer);
  const chunks = useFrameSelector(selectChunks);
  const submit = useConversation((s) => s.submit);
  const busy = isBusy(phase);
  const [showPipeline, setShowPipeline] = React.useState(false);
  const titles = useTitles(sources);
  const compareIds = plan?.mode === "compare" ? plan.documents.map((d) => d.id) : undefined;
  const turn: TurnData = { focus: { kind: "live" }, sources, checkByChip, docLabels: labelDocuments(sources, compareIds), titles };
  const total = stages.at(-1)?.endedAt && stages[0].startedAt ? stages.at(-1)!.endedAt! - stages[0].startedAt : null;
  const focusLive = () => useEvidence.getState().focusTurn({ kind: "live" });

  if (phase === "idle") return null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: ease.outExpo }}
      aria-label="Current answer"
      className="flex min-w-0 flex-col gap-4"
      onFocusCapture={focusLive}
      onPointerDownCapture={focusLive}
    >
      <Question text={question} />
      <div className="flex min-w-0 flex-col gap-4">
        {busy || showPipeline ? (
          <div className="rounded-lg border border-line bg-surface p-4">
            <PipelineStepper stages={stages} plan={plan} live={busy} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPipeline(true)}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-md px-2 text-xs text-ink-subtle hover:bg-surface-3 hover:text-ink"
            aria-expanded={false}
          >
            Pipeline {total !== null && <span className="font-mono tabular">· {formatMs(total)}</span>}
            <ChevronDown aria-hidden className="size-3.5" />
          </button>
        )}
        {plan && <PlanBanner plan={plan} />}
        <TurnProvider value={turn}>
          <div aria-live="off" aria-busy={busy} className={cn("min-w-0", phase === "refused" && !answer && "hidden")}>
            {answer ? (
              <AnswerText text={answer} streaming={busy} />
            ) : busy ? (
              <div aria-hidden className="flex flex-col gap-2.5">
                {[92, 78, 85].map((w) => (
                  <span key={w} className="relative block h-3.5 overflow-hidden rounded-sm bg-surface-3" style={{ width: `${w}%` }}>
                    <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </TurnProvider>
        {phase === "refused" && <RefusalCard refusal={refusal} onSuggest={(q) => void submit(q)} disabled={busy} />}
        {phase === "error" && error && <ErrorCard error={error} hasPartial={answer.length > 0} onRetry={() => void submit(question)} />}
        {phase === "aborted" && <p className="m-0 text-sm text-ink-subtle">Stopped. The partial answer was not page-checked.</p>}
        {phase === "complete" && <AnswerMeta answer={answer} sources={sources ?? []} checks={checks ?? []} usage={usage} chunks={chunks} />}
      </div>
    </motion.article>
  );
}

/** A turn loaded from chat history. */
export function SavedTurn({ message }: { message: ChatMessage }) {
  const titles = useTitles(message.sources);
  const checkByChip = React.useMemo(() => assignChecks(message.answer, message.citations), [message]);
  const turn: TurnData = { focus: { kind: "message", id: message.id }, sources: message.sources, checkByChip, docLabels: labelDocuments(message.sources), titles };
  const focus = () => useEvidence.getState().focusTurn({ kind: "message", id: message.id });
  const submit = useConversation((s) => s.submit);
  return (
    <article aria-label={`Earlier answer: ${decodeEntities(message.question)}`} className="flex min-w-0 flex-col gap-4" onFocusCapture={focus} onPointerDownCapture={focus}>
      <Question text={message.question} />
      {message.refused ? (
        <RefusalCard refusal={null} onSuggest={(q) => void submit(q)} disabled={false} />
      ) : (
        <>
          <TurnProvider value={turn}>
            <AnswerText text={message.answer} streaming={false} />
          </TurnProvider>
          <AnswerMeta answer={message.answer} sources={message.sources} checks={message.citations} usage={null} chunks={null} />
        </>
      )}
    </article>
  );
}
