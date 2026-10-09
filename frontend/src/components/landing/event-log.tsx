"use client";

import * as React from "react";
import { useReplay } from "@/hooks/use-replay";
import { SAMPLE_DOC } from "@/lib/landing/sample";
import { cn } from "@/lib/utils";
import { DemoLabel } from "./demo-label";

type Line = { at: number; type: string; body: string };

const LINES: Line[] = [
  { at: 300, type: "stage", body: '"understanding"' },
  { at: 900, type: "stage", body: '"searching"' },
  { at: 2000, type: "plan", body: '{ mode: "single", contributing: 1 }' },
  { at: 2400, type: "stage", body: '"reranking"' },
  { at: 2900, type: "sources", body: "[ 6 passages · page + section each ]" },
  { at: 3300, type: "stage", body: '"drafting"' },
  { at: 3700, type: "token", body: '"The security deposit is refunded…"' },
  { at: 6200, type: "done", body: `{ refused: false, citations: [ supported, supported, partial ] }` },
];
const LENGTH = 9_500;
const TOKEN_START = 3700;
const TOKEN_END = 6100;

const TYPE_COLOR: Record<string, string> = {
  stage: "text-[#7c9cff]",
  plan: "text-partial",
  sources: "text-verified",
  token: "text-[#a3a8b3]",
  done: "text-verified",
};

/** The actual SSE contract of POST /ask/stream, replayed as a log. */
export function EventLog() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { t } = useReplay(ref, LENGTH, LENGTH - 1);
  const tokens = t < TOKEN_START ? 0 : Math.min(186, Math.round(((Math.min(t, TOKEN_END) - TOKEN_START) / (TOKEN_END - TOKEN_START)) * 186));
  return (
    <div ref={ref} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-[#0b0d10] text-[#d6d9df] shadow-panel">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="font-mono text-[11.5px] text-white/70">POST /ask/stream · text/event-stream</span>
        <DemoLabel className="border-white/15 bg-white/5 text-white/70">Replay</DemoLabel>
      </div>
      <ol className="m-0 flex min-h-[300px] list-none flex-col gap-1.5 p-4 font-mono text-[12px] leading-relaxed" aria-label="Events in the order the server sends them">
        {LINES.map((line, i) => {
          const shown = t >= line.at;
          return (
            <li key={i} className={cn("flex min-w-0 gap-2 transition-[opacity,visibility] duration-300", shown ? "visible opacity-100" : "invisible opacity-0")}>
              <span className="shrink-0 text-white/35">data:</span>
              <span className={cn("shrink-0", TYPE_COLOR[line.type])}>{line.type}</span>
              <span className="min-w-0 break-anywhere text-white/80">
                {line.body}
                {line.type === "token" && shown && <span className="ml-2 text-white/40 tabular">× {tokens}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="m-0 border-t border-white/10 px-4 py-2.5 font-mono text-[11px] text-white/50">
        Unknown or malformed events are dropped, never thrown. A close without done keeps the partial answer.
      </p>
      <span className="sr-only">Example document {SAMPLE_DOC.id}.</span>
    </div>
  );
}
