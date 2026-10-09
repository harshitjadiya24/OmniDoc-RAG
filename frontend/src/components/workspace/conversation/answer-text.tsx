"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MARKDOWN_COMPONENTS } from "@/components/ui/markdown";
import { holdPartialCitation } from "@/lib/rag/citations";
import { cn } from "@/lib/utils";
import { ChipGroup } from "./citation-chip";
import { countGroups, remarkCitations } from "./citations-plugin";

const COMPONENTS = {
  ...MARKDOWN_COMPONENTS,
  "cite-chip": ({ group, refs }: { group?: string; refs?: string }) => {
    let parsed: [string, number | null][] = [];
    try {
      parsed = JSON.parse(refs ?? "[]") as [string, number | null][];
    } catch {
      parsed = [];
    }
    return <ChipGroup group={Number(group ?? 0)} refs={parsed} />;
  },
} as unknown as Components;

/** One markdown block. Memoized on its text, so finished blocks never re-render while the next one streams. */
const Block = React.memo(function Block({ text, offset }: { text: string; offset: number }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, [remarkCitations, { offset }]]} skipHtml components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
});

/** Splits on blank lines outside fenced code, so each finished block can be memoized. */
function blocks(text: string): string[] {
  const out: string[] = [];
  let fenced = false;
  let current: string[] = [];
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && line.trim() === "" && current.length) {
      out.push(current.join("\n"));
      current = [];
    } else if (line.trim() !== "" || current.length) {
      current.push(line);
    }
  }
  if (current.length) out.push(current.join("\n"));
  return out;
}

/** The answer as markdown with live citation chips. While streaming, a half-written citation is held back. */
export function AnswerText({ text, streaming, className }: { text: string; streaming: boolean; className?: string }) {
  const visible = streaming ? holdPartialCitation(text) : text;
  const parts = blocks(visible);
  const offsets = parts.reduce<number[]>((acc, part, i) => [...acc, i === 0 ? 0 : acc[i - 1] + countGroups(parts[i - 1])], []);
  return (
    <div className={cn("prose-doc answer-text", className)}>
      {parts.map((part, i) => (
        <Block key={i} text={part} offset={offsets[i]} />
      ))}
      {streaming && <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-caret bg-verified" />}
    </div>
  );
}
