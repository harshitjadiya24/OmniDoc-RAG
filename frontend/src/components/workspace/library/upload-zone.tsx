"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/stores/library";

/** Drop PDFs anywhere on the zone, or pick them with the button. */
export function UploadZone({ compact = false }: { compact?: boolean }) {
  const upload = useLibrary((s) => s.upload);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const id = React.useId();

  const send = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length) void upload(files);
  };

  return (
    <div
      data-active={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        send(e.dataTransfer.files);
      }}
      className={cn(
        "glow-ring group relative flex min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 text-center transition-colors",
        over && "border-verified bg-verified-wash",
        compact ? "px-3 py-4" : "px-4 py-7",
      )}
    >
      <span aria-hidden className={cn("grid place-items-center rounded-full border border-line bg-surface text-ink-muted transition-transform duration-300 group-data-[active=true]:-translate-y-0.5 group-data-[active=true]:text-verified-text", compact ? "size-9" : "size-11")}>
        <FileUp className="size-4" />
      </span>
      <p className="m-0 text-sm text-ink">
        <label htmlFor={id} className="cursor-pointer font-medium text-verified-text underline decoration-verified/40 underline-offset-4 hover:decoration-verified">
          Choose PDFs
        </label>{" "}
        or drop them here
      </p>
      {!compact && <p className="m-0 text-xs text-ink-subtle">Text PDFs and scanned pages (OCR). Up to 50 MB each.</p>}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          send(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
