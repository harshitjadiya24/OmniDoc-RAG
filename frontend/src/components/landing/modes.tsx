"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { TriangleAlert } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { duration, ease } from "@/lib/motion";
import { DemoLabel } from "./demo-label";
import { Reveal } from "./reveal";
import { Section } from "./section";

type Mode = "single" | "multi" | "compare";

function Chip({ doc, page }: { doc?: string; page: number }) {
  return (
    <span className="mx-0.5 inline-flex h-[1.4em] items-center gap-1 rounded-[5px] border border-verified/40 bg-verified-wash px-1.5 align-middle font-mono text-[0.72em] text-verified-text">
      {doc && <b>{doc}</b>}p.{page}
    </span>
  );
}

const PREVIEW: Record<Mode, React.ReactNode> = {
  single: (
    <p className="m-0 text-[15px] leading-[1.8] text-ink">
      Notice to end the tenancy must be given in writing two months ahead <Chip page={5} />, and it cannot expire before the first anniversary <Chip page={5} />.
    </p>
  ),
  multi: (
    <div className="flex flex-col gap-3 text-[15px] leading-[1.8] text-ink">
      <p className="m-0">
        <b className="font-medium">Lease:</b> repairs to the structure fall to the landlord <Chip doc="A" page={6} />.
      </p>
      <p className="m-0">
        <b className="font-medium">Building rules:</b> tenants report faults within 48 hours <Chip doc="B" page={2} />.
      </p>
      <p className="m-0 flex items-start gap-2 text-sm text-partial-text">
        <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" /> Insurance schedule contributed no passages, so the answer cannot speak for it.
      </p>
    </div>
  ),
  compare: (
    <div className="grid grid-cols-1 gap-4 text-[14px] leading-relaxed text-ink sm:grid-cols-2">
      {[
        ["In both", <>Rent is due monthly in advance <Chip doc="A" page={3} /> <Chip doc="B" page={3} /></>],
        ["Differences", <>Deposit: A refunds in 30 days <Chip doc="A" page={4} />; B in 14 days <Chip doc="B" page={4} /></>],
        ["Only in A", <>A break clause after 12 months <Chip doc="A" page={5} /></>],
        ["Only in B", <>Nothing found in the excerpts.</>],
      ].map(([h, body]) => (
        <div key={String(h)} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-3">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{h}</span>
          <span>{body}</span>
        </div>
      ))}
    </div>
  ),
};

const COPY: Record<Mode, { title: string; body: string }> = {
  single: { title: "Ask one or many documents", body: "Every selected document is searched together and the best passages win." },
  multi: { title: "Hear from each document", body: "Ask about “each” document and they are searched one by one, interleaved, with a warning for any that had nothing to say." },
  compare: { title: "Compare two versions", body: "Four fixed sections, every line cited and page-checked. An empty section says so instead of inventing a difference." },
};

export function Modes() {
  const [mode, setMode] = React.useState<Mode>("compare");
  return (
    <Section
      id="modes"
      index="05"
      eyebrow="Modes"
      title={
        <>
          One question, <em>or two documents side by side.</em>
        </>
      }
      lede="The planner reads your question and your selection, picks a strategy, and tells you which one it chose and why."
    >
      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Segmented
            label="Answer mode"
            layoutId="landing-mode"
            items={[
              { value: "single", label: "Single" },
              { value: "multi", label: "Multi" },
              { value: "compare", label: "Compare" },
            ]}
            value={mode}
            onChange={setMode}
            className="w-full"
          />
          <h3 className="m-0 font-display text-3xl font-normal text-ink">{COPY[mode].title}</h3>
          <p className="m-0 text-[15px] leading-relaxed text-ink-muted">{COPY[mode].body}</p>
        </div>
        <div className="relative min-h-[260px] min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <DemoLabel className="mb-4">Illustration · fictional documents</DemoLabel>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: duration.base, ease: ease.outExpo }}>
              {PREVIEW[mode]}
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
    </Section>
  );
}
