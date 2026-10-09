import { cn } from "@/lib/utils";

/** The OmniDoc mark: a page with a folded corner and a verification tick. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-inverse" />
      <path d="M10 7h8.5L23 11.5V24a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" className="fill-on-inverse" />
      <path d="M18.5 7v3.5a1 1 0 0 0 1 1H23" className="fill-none stroke-inverse" strokeWidth="1.2" />
      <path d="m12.3 18.2 2.4 2.4 4.9-5" className="fill-none stroke-verified" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
        OmniDoc<span className="font-display text-[19px] font-normal italic text-ink-muted"> rag</span>
      </span>
    </span>
  );
}
