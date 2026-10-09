"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { IngestVisual } from "./ingest-visual";
import { Section } from "./section";

const STEPS = [
  { name: "Extract", file: "extract.py", body: "PyMuPDF reads every page in layout order and keeps the page number on each block. Ruled tables become rows; image-only pages are OCRed with Tesseract." },
  { name: "Clean", file: "doctypes/strategies.py", body: "Running headers, footers and watermarks repeated on most pages are dropped, along with table-of-contents leader lines." },
  { name: "Classify", file: "doctypes/classify.py", body: "Six document types are scored by distinctive phrases in the opening pages. The matched phrases are stored and shown, so the type explains itself." },
  { name: "Chunk", file: "chunking.py", body: "Text is packed into passages of 700 to 1,100 characters under their nearest heading. Each passage keeps its page and section, which become the citation." },
  { name: "Metadata", file: "doctypes/metadata.py", body: "Title, date, issuer and reference number are detected from the first pages, labelled “Detected from the PDF”, and editable." },
  { name: "Embed & index", file: "engine.py", body: "Passages are embedded locally with bge-small into Chroma and tokenised for BM25. Full page text is kept so citations can be checked later." },
  { name: "Summarise", file: "summarize.py", body: "One model pass writes a summary and four questions the document can answer. Best effort: the document works without it." },
  { name: "Lineage", file: "doctypes/lineage.py", body: "A document can declare what it supersedes, by ID or reference number. The older one is marked superseded everywhere it appears." },
];

/** Scroll-driven walkthrough of ingestion: the steps scroll, the page illustration follows. */
export function Ingestion() {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);

  React.useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-50% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <Section
      id="pipeline"
      index="02"
      eyebrow="Ingestion"
      title={
        <>
          From a PDF to <em>citable passages.</em>
        </>
      }
      lede="Uploading starts a background job you can watch stage by stage. By the end, every passage knows its page and section, and every page is kept for checking."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div className="sticky top-[calc(var(--header-h,64px)+0.75rem)] z-10 flex h-[360px] flex-col gap-2 rounded-2xl border border-line bg-surface-2 p-4 sm:h-[420px] lg:top-[calc(var(--header-h,64px)+2rem)] lg:h-[min(640px,calc(100dvh-var(--header-h,64px)-4rem))] lg:p-8">
          <div className="min-h-0 flex-1">
            <IngestVisual step={active} />
          </div>
          <p className="m-0 shrink-0 font-mono text-[11px] text-ink-subtle tabular" aria-live="polite">
            <span className="sr-only">Showing step </span>
            {String(active + 1).padStart(2, "0")} / 08 · {STEPS[active].name}
          </p>
        </div>
        <ol className="m-0 flex list-none flex-col p-0">
          {STEPS.map((s, i) => (
            <li
              key={s.name}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-step={i}
              className="flex min-h-[46svh] flex-col justify-center py-6 lg:min-h-[62svh]"
            >
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                className={cn("group flex flex-col gap-3 rounded-xl border p-5 text-left transition-[border-color,background-color] duration-500", active === i ? "border-verified/40 bg-surface" : "border-transparent hover:bg-surface/60")}
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-verified-text tabular">{String(i + 1).padStart(2, "0")}</span>
                  <span className={cn("font-display text-3xl leading-none transition-colors duration-500", active === i ? "text-ink" : "text-ink-muted")}>{s.name}</span>
                </span>
                <span className={cn("text-[15px] leading-relaxed transition-colors duration-500", active === i ? "text-ink-muted" : "text-ink-subtle")}>{s.body}</span>
                <span className="font-mono text-xs text-ink-subtle">backend/src/docqa/{s.file}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
