"use client";

import * as React from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useHeaderHeight } from "@/hooks/use-header-height";

/** Compact workspace bar: brand, palette trigger, account and theme. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  const ref = React.useRef<HTMLElement>(null);
  useHeaderHeight(ref);
  return (
    <header ref={ref} className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-[clamp(0.75rem,2vw,1.25rem)]">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="rounded-md" aria-label="OmniDoc home">
            <Wordmark />
          </Link>
          <span aria-hidden className="hidden h-5 w-px bg-line-strong sm:block" />
          <span className="hidden truncate text-sm text-ink-muted sm:block">Workspace</span>
        </div>
        <div className="flex items-center gap-1.5">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
