"use client";

import { AnimatePresence, motion } from "motion/react";
import { History } from "lucide-react";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

const T = { duration: duration.slow, ease: ease.outExpo };

/** Grey text lines standing in for a paragraph. */
function Lines({ widths, className }: { widths: number[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {widths.map((w, i) => (
        <span key={i} className="block h-1.5 rounded-full bg-ink/15" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

const CHUNK_TINT = ["bg-verified/12 ring-verified/50", "bg-partial/12 ring-partial/60", "bg-[#7c9cff]/12 ring-[#7c9cff]/60"];

function Block({ step, i, label, children }: { step: number; i: number; label: string; children: React.ReactNode }) {
  const outlined = step === 0;
  const chunked = step === 3;
  return (
    <motion.div
      layout
      transition={T}
      className={cn("relative rounded-md p-2 ring-1 ring-transparent transition-[background-color,box-shadow] duration-500", outlined && "outline outline-1 outline-dashed outline-ink/30", chunked && CHUNK_TINT[i % 3])}
    >
      {children}
      <AnimatePresence>
        {(outlined || chunked) && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={T}
            className="absolute -top-2 right-2 rounded bg-surface px-1.5 font-mono text-[9.5px] text-ink-muted shadow-sm ring-1 ring-line"
          >
            {chunked ? ["§4 Security deposit · p.4", "§4 · table rows · p.4", "§5 Termination · p.4"][i] : label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The page being ingested, transformed by each step: 0 extract … 7 lineage. */
export function IngestVisual({ step }: { step: number }) {
  const embedded = step >= 5;
  return (
    <div className="relative grid h-full min-h-0 place-items-center" aria-hidden>
      <motion.div
        animate={{ scale: step === 7 ? 0.82 : 1, x: step === 7 ? "-14%" : 0, rotate: step === 7 ? -2 : 0 }}
        transition={T}
        className="relative flex aspect-[3/4] h-full max-h-full w-auto max-w-full flex-col gap-3 overflow-hidden rounded-lg border border-line-strong bg-surface p-[6%] shadow-panel"
      >
        <motion.div animate={{ opacity: step === 1 ? 0.35 : step > 1 ? 0 : 1 }} transition={T} className="relative flex items-center justify-between font-mono text-[8.5px] tracking-wide text-ink-subtle">
          HARBOUR LANE LEASE · CONFIDENTIAL
          {step === 1 && <span className="absolute inset-x-0 top-1/2 h-px bg-unsupported" />}
        </motion.div>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[15px] leading-tight text-ink">Residential lease agreement</span>
          <span className={cn("w-fit rounded px-0.5 font-mono text-[8.5px] text-ink-subtle transition-colors", step === 4 && "bg-verified/20 text-ink")}>Ref. HL/2025/014 · 3 March 2025</span>
        </div>
        <motion.div animate={{ opacity: embedded ? 0 : 1, filter: embedded ? "blur(2px)" : "blur(0px)" }} transition={T} className="flex flex-col gap-2.5">
          <Block step={step} i={0} label="text · p.4">
            <p className={cn("m-0 mb-1.5 text-[9.5px] font-semibold text-ink")}>4. Security deposit</p>
            <p className="m-0 text-[8.5px] leading-snug text-ink-muted">
              <mark className={cn("bg-transparent text-inherit transition-colors", step === 2 && "rounded-sm bg-partial/40")}>This agreement</mark> binds{" "}
              <mark className={cn("bg-transparent text-inherit transition-colors", step === 2 && "rounded-sm bg-partial/40")}>the parties</mark>. The deposit is refunded within 30 days.
            </p>
            <Lines widths={[94, 88, 60]} className="mt-1.5" />
          </Block>
          <Block step={step} i={1} label="table · p.4">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-line font-mono text-[7.5px] text-ink-muted">
              {["Item", "Amount", "Due", "Deposit", "£1,200", "On signing", "Rent", "£950", "Monthly"].map((c, i) => (
                <span key={i} className={cn("bg-surface px-1 py-0.5", i < 3 && "font-semibold text-ink")}>
                  {c}
                </span>
              ))}
            </div>
          </Block>
          <Block step={step} i={2} label="text · p.4">
            <p className="m-0 mb-1.5 text-[9.5px] font-semibold text-ink">
              5. <mark className={cn("bg-transparent text-inherit transition-colors", step === 2 && "rounded-sm bg-partial/40")}>Termination</mark>
            </p>
            <Lines widths={[90, 96, 72, 40]} />
          </Block>
        </motion.div>
        <motion.div animate={{ opacity: step === 1 ? 0.35 : step > 1 ? 0 : 1 }} transition={T} className="relative mt-auto text-center font-mono text-[8.5px] text-ink-subtle">
          Page 4 of 12
          {step === 1 && <span className="absolute inset-x-1/3 top-1/2 h-px bg-unsupported" />}
        </motion.div>

        <AnimatePresence>
          {step === 2 && (
            <motion.span key="type" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={T} className="absolute top-[4%] right-[4%] rounded-full bg-inverse px-2.5 py-1 font-mono text-[10px] text-on-inverse">
              Contract · 75%
            </motion.span>
          )}
          {embedded && step !== 7 && (
            <motion.div key="vec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T} className="absolute inset-0 grid place-items-center">
              {step === 5 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="grid grid-cols-12 gap-1">
                    {Array.from({ length: 48 }, (_, i) => (
                      <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: (i % 12) * 0.02 + Math.floor(i / 12) * 0.05, ...T }} className="size-2 rounded-full bg-verified" style={{ opacity: 0.25 + ((i * 37) % 70) / 100 }} />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-ink-muted">384-dim vectors → Chroma · tokens → BM25</span>
                </div>
              ) : (
                <div className="flex w-[80%] flex-col gap-2 rounded-md bg-surface/90 p-3 ring-1 ring-line">
                  <span className="font-mono text-[9px] tracking-wide text-ink-subtle uppercase">Summary</span>
                  <Lines widths={[96, 90, 94, 70]} />
                  <span className="mt-1 font-mono text-[9px] tracking-wide text-ink-subtle uppercase">Questions it answers</span>
                  {["When is the deposit refunded?", "What ends the tenancy early?"].map((q) => (
                    <span key={q} className="rounded border border-line bg-surface-2 px-2 py-1 text-[9px] text-ink">
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {step === 4 && (
          <motion.dl
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={T}
            className="absolute right-0 bottom-[8%] m-0 grid w-[46%] min-w-[150px] gap-1.5 rounded-lg border border-line bg-surface p-3 text-[10px] shadow-panel"
          >
            {[
              ["Title", "Residential lease agreement"],
              ["Date", "2025-03-03"],
              ["Reference", "HL/2025/014"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[9px] tracking-wide text-ink-subtle uppercase">{k}</dt>
                <dd className="m-0 truncate font-mono text-ink">{v}</dd>
              </div>
            ))}
            <span className="text-[9px] text-verified-text">Detected from the PDF</span>
          </motion.dl>
        )}
        {step === 7 && (
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={T} className="absolute top-[10%] right-0 flex w-[44%] min-w-[150px] flex-col gap-2 rounded-lg border border-verified/50 bg-surface p-3 shadow-panel">
            <span className="font-display text-sm leading-tight text-ink">Lease, 2026 renewal</span>
            <span className="font-mono text-[9px] text-ink-subtle">supersedes HL/2025/014</span>
            <span className="w-fit rounded-full bg-verified-wash px-2 py-0.5 text-[9.5px] text-verified-text">Current version</span>
          </motion.div>
        )}
      </AnimatePresence>
      {step === 7 && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, ...T }} className="absolute bottom-[14%] left-[6%] inline-flex items-center gap-1 rounded-full bg-superseded-wash px-2 py-0.5 text-[10px] text-superseded-text ring-1 ring-superseded/40">
          <History className="size-3" /> Superseded
        </motion.span>
      )}
    </div>
  );
}
