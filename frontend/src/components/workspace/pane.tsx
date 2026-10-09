"use client";

import * as React from "react";
import { useScrollEdges } from "@/hooks/use-scroll-edges";
import { cn } from "@/lib/utils";

type PaneProps = {
  label: string;
  heading?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

/** A workspace column: a fixed header, one independent scroll region with edge shadows, an optional footer. */
export function Pane({ label, heading, meta, footer, children, className, bodyClassName, scrollRef }: PaneProps) {
  const ownRef = React.useRef<HTMLDivElement>(null);
  const ref = scrollRef ?? ownRef;
  const { top, bottom } = useScrollEdges(ref);
  return (
    <section aria-label={label} className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      {(heading || meta) && (
        <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <div className="min-w-0">{heading}</div>
          {meta && <div className="flex shrink-0 items-center gap-2">{meta}</div>}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-black/15 to-transparent opacity-0 transition-opacity dark:from-black/50", top && "opacity-100")} />
        <div ref={ref} role="region" aria-label={`${label} content`} tabIndex={0} className={cn("h-full overflow-y-auto overscroll-contain focus-visible:outline-offset-[-2px]", bodyClassName)}>
          {children}
        </div>
        <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-black/15 to-transparent opacity-0 transition-opacity dark:from-black/50", bottom && "opacity-100")} />
      </div>
      {footer && <div className="shrink-0 border-t border-line">{footer}</div>}
    </section>
  );
}
