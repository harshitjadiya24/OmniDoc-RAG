"use client";

import * as React from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GITHUB_URL } from "@/lib/env";
import { duration, ease, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useHeaderHeight } from "@/hooks/use-header-height";
import { SITE_NAV } from "@/lib/site-nav";

export function SiteHeader() {
  const ref = React.useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  useHeaderHeight(ref);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-30 border-b transition-[background-color,border-color] duration-300",
        scrolled ? "border-line bg-bg/80 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-[clamp(1rem,3vw,2.5rem)]">
        <Link href="/" className="min-w-0 rounded-md" aria-label="OmniDoc home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {SITE_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex h-10 items-center rounded-md px-3 text-sm text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          {GITHUB_URL && (
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden h-10 items-center gap-1 rounded-md px-3 text-sm text-ink-muted hover:text-ink md:inline-flex">
              GitHub <ArrowUpRight aria-hidden className="size-3.5" />
            </a>
          )}
          <ThemeToggle />
          <ButtonLink href="/app" variant="primary" size="sm" className="hidden sm:inline-flex">
            Open workspace
          </ButtonLink>
          <MobileMenu open={open} onOpenChange={setOpen} />
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-3 top-3 z-50 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-panel"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: duration.base, ease: ease.outExpo }}
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title className="eyebrow">Menu</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu">
                      <X />
                    </Button>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Site sections and the workspace link.</Dialog.Description>
                <ul className="mt-2 flex flex-col">
                  {SITE_NAV.map((item, i) => (
                    <motion.li key={item.href} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: stagger(i), duration: duration.base }}>
                      <a href={item.href} onClick={() => onOpenChange(false)} className="flex min-h-12 items-center border-b border-line text-lg text-ink">
                        {item.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
                <ButtonLink href="/app" variant="primary" size="lg" className="mt-4 w-full">
                  Open workspace
                </ButtonLink>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
