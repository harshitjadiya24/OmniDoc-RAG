import type * as React from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

type Props = {
  id: string;
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** A landing section: numbered eyebrow, display heading, optional lede, then content. */
export function Section({ id, index, eyebrow, title, lede, children, className }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("relative scroll-mt-20 overflow-x-clip border-t border-line", className)}>
      <div className="mx-auto max-w-[1280px] px-[clamp(1rem,3vw,2.5rem)] py-[clamp(4rem,9vw,8rem)]">
        <Reveal className="flex max-w-[760px] flex-col gap-4">
          <p className="eyebrow m-0 flex items-center gap-3">
            <span className="text-verified-text">{index}</span>
            <span aria-hidden className="h-px w-8 bg-line-strong" />
            {eyebrow}
          </p>
          <h2 id={`${id}-title`} className="m-0 font-display text-[clamp(2.25rem,1.3rem+3.6vw,4.25rem)] leading-[1] font-normal tracking-[-0.015em]">
            {title}
          </h2>
          {lede && <p className="m-0 max-w-[62ch] text-[17px] leading-relaxed text-ink-muted">{lede}</p>}
        </Reveal>
        <div className="mt-[clamp(2.5rem,5vw,4rem)]">{children}</div>
      </div>
    </section>
  );
}
