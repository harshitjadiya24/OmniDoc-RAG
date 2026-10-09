import { cn } from "@/lib/utils";

/** Every scripted demo says so. Nothing on this page is presented as a real result. */
export function DemoLabel({ children = "Sample replay · scripted, not your documents", className }: { children?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-ink-muted uppercase", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-partial" />
      {children}
    </span>
  );
}
