"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, LocateFixed } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/api/session";
import { matchRuns, runRect, type Rect, type TextRun } from "@/lib/rag/pdf-highlight";

type Status = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

/** Renders one page of the stored original to a canvas and highlights the passage on the cited page. */
export function PdfPage({ url, page, highlight, title }: { url: string; page: number; highlight: string | null; title: string }) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [current, setCurrent] = React.useState(page);
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [marks, setMarks] = React.useState<Rect[]>([]);
  const [status, setStatus] = React.useState<Status>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    loadPdfjs()
      .then((pdfjs) => {
        const loading = pdfjs.getDocument({ url, httpHeaders: authHeaders() });
        task = loading;
        return loading.promise;
      })
      .then((loaded) => {
        if (cancelled) return;
        setDoc(loaded);
        setCurrent(Math.min(Math.max(1, page), loaded.numPages));
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "error", message: "The PDF could not be loaded. Documents uploaded before originals were kept need to be uploaded again to view them." });
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, page]);

  React.useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas || width === 0) return;
    let cancelled = false;
    let render: RenderTask | null = null;
    (async () => {
      const pdfPage = await doc.getPage(current);
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: width / base.width });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      render = pdfPage.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
      await render.promise;
      const runs = current === page && highlight ? ((await pdfPage.getTextContent()).items.filter((i) => "str" in i) as TextRun[]) : [];
      if (cancelled) return;
      setHeight(viewport.height);
      setMarks(highlight ? matchRuns(runs, highlight).map((i) => runRect(runs[i], viewport.transform, viewport.scale)) : []);
      setStatus({ kind: "ready" });
    })().catch((e: unknown) => {
      if (!cancelled && !(e instanceof Error && e.name === "RenderingCancelledException")) setStatus({ kind: "error", message: "This page could not be rendered." });
    });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, current, width, page, highlight]);

  const total = doc?.numPages ?? 0;
  const cited = current === page;
  const go = (p: number) => {
    setStatus({ kind: "loading" });
    setCurrent(p);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => go(current - 1)} disabled={!doc || current <= 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="min-w-[8.5rem] text-center font-mono text-xs text-ink-muted tabular" aria-live="polite">
            {total ? `Page ${current} of ${total}` : "Loading…"}
          </span>
          <Button variant="outline" size="icon" onClick={() => go(current + 1)} disabled={!doc || current >= total} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
        {!cited && doc && (
          <Button variant="ghost" size="sm" onClick={() => go(page)}>
            <LocateFixed /> Back to page {page}
          </Button>
        )}
      </div>
      <div ref={frameRef} className="relative min-h-[60svh] w-full min-w-0 overflow-hidden rounded-md border border-line bg-white shadow-panel">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Page ${current} of ${title}${cited && marks.length ? ", passage highlighted" : ""}`}
          className="block w-full"
          style={{ height: height ? `${height}px` : undefined }}
        />
        {status.kind === "ready" &&
          cited &&
          marks.map((r, i) => <span key={i} aria-hidden className="pdf-mark pointer-events-none absolute" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />)}
        {status.kind === "loading" && <div aria-hidden className="absolute inset-0 animate-pulse bg-surface-3 motion-reduce:animate-none" />}
      </div>
      {status.kind === "error" && (
        <p role="alert" className="m-0 text-sm text-partial-text">
          {status.message}
        </p>
      )}
      {status.kind === "ready" && cited && highlight && marks.length === 0 && (
        <p className="m-0 text-xs text-ink-subtle">The passage couldn’t be located precisely on this page, so nothing is highlighted.</p>
      )}
    </div>
  );
}
