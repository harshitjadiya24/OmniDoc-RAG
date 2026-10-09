"use client";

import type * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type Side = "left" | "right" | "bottom";

const PANEL: Record<Side, string> = {
  left: "inset-y-0 left-0 h-dvh w-[min(92vw,var(--sheet-w,380px))] border-r",
  right: "inset-y-0 right-0 h-dvh w-[min(96vw,var(--sheet-w,520px))] border-l",
  bottom: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t pb-[env(safe-area-inset-bottom)]",
};

const OFFSET: Record<Side, { x?: string; y?: string }> = {
  left: { x: "-100%" },
  right: { x: "100%" },
  bottom: { y: "100%" },
};

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: Side;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Shown visually; the description is always available to screen readers. */
  hideDescription?: boolean;
  width?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Modal side panel on Radix Dialog: focus trap, Escape, scroll lock, portal. */
export function Sheet({ open, onOpenChange, side = "right", title, description, hideDescription, width, actions, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.base }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                style={width ? ({ "--sheet-w": `${width}px` } as React.CSSProperties) : undefined}
                className={cn("fixed z-50 flex flex-col border-line bg-surface shadow-panel focus:outline-none", PANEL[side], className)}
                initial={{ ...OFFSET[side], opacity: 0.6 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={{ ...OFFSET[side], opacity: 0.6, transition: { duration: duration.base, ease: ease.inOut } }}
                transition={spring.drawer}
              >
                <div className="flex min-w-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="m-0 text-base font-semibold break-anywhere text-ink">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className={cn("m-0 mt-1 text-sm text-ink-muted", hideDescription && "sr-only")}>{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">Details panel</Dialog.Description>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {actions}
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon" aria-label="Close">
                        <X />
                      </Button>
                    </Dialog.Close>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
