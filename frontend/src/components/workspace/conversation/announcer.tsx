"use client";

import { STAGES } from "@/lib/api/schemas";
import { plural } from "@/lib/format";
import { useConversation } from "@/stores/conversation";
import { STAGE_ANNOUNCE } from "./pipeline-stepper";

/** Screen-reader narration of progress. Never announces individual tokens. */
export function Announcer() {
  const message = useConversation((s) => {
    switch (s.phase) {
      case "submitting":
        return "Sending your question.";
      case "streaming": {
        const i = s.stages.findIndex((x) => x.status === "active");
        return i === -1 ? "Answering." : `Step ${i + 1} of ${STAGES.length}: ${STAGE_ANNOUNCE[s.stages[i].id]}.`;
      }
      case "complete":
        return `Answer complete, ${plural(s.sources?.length ?? 0, "source")}, ${plural(s.checks?.length ?? 0, "citation")} checked.`;
      case "refused":
        return "No answer: the documents don't contain the evidence.";
      case "error":
        return `The answer stopped. ${s.error?.message ?? ""}`;
      case "aborted":
        return "Stopped.";
      default:
        return "";
    }
  });
  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  );
}
