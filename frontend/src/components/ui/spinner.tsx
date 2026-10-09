import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center", className)}>
      <svg viewBox="0 0 16 16" aria-hidden className="size-4 animate-spin motion-reduce:animate-none">
        <circle cx="8" cy="8" r="6.5" className="fill-none stroke-current opacity-20" strokeWidth="2" />
        <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" className="fill-none stroke-current" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
