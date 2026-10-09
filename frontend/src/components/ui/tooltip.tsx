"use client";

import type * as React from "react";
import * as T from "@radix-ui/react-tooltip";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <T.Provider delayDuration={250} skipDelayDuration={150}>
    {children}
  </T.Provider>
);

/** Supplementary hint. Never the only place information lives: the trigger keeps its own accessible name. */
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="z-[80] max-w-[280px] rounded-md border border-line bg-inverse px-2.5 py-1.5 text-xs leading-snug text-on-inverse shadow-panel"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
