"use client";

import dynamic from "next/dynamic";
import { Sheet } from "@/components/ui/sheet";
import { documentFileUrl } from "@/lib/api/documents";
import { useEvidence } from "@/stores/evidence";

const PdfPage = dynamic(() => import("./pdf-page").then((m) => m.PdfPage), {
  ssr: false,
  loading: () => <div aria-hidden className="min-h-[60svh] rounded-md border border-line bg-surface-3" />,
});

/** The stored original, opened at the cited page with the passage highlighted. */
export function PdfSheet() {
  const target = useEvidence((s) => s.pdf);
  const openPdf = useEvidence((s) => s.openPdf);
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => !open && openPdf(null)}
      title={target?.title ?? "Document"}
      description={target ? `${target.docId} · page ${target.page}. ${target.passage || target.evidence ? "The passage used as evidence is highlighted." : "The original upload."}` : undefined}
      width={760}
    >
      {target && (
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {target.evidence && (
            <figure className="m-0 rounded-lg border border-line bg-surface-2 p-3">
              <figcaption className="eyebrow mb-1.5">Closest sentence to the claim</figcaption>
              <blockquote className="m-0 text-sm leading-relaxed text-ink break-anywhere">“{target.evidence}”</blockquote>
            </figure>
          )}
          <PdfPage key={`${target.docId}:${target.page}`} url={documentFileUrl(target.docId)} page={target.page} highlight={target.passage ?? target.evidence} title={target.title} />
        </div>
      )}
    </Sheet>
  );
}
