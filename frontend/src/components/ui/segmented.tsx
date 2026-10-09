"use client";

import { motion } from "motion/react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Item<T extends string> = { value: T; label: string; disabled?: boolean };

/** Radio group styled as a segmented control, with a sliding indicator. Arrow keys move between options. */
export function Segmented<T extends string>({
  label,
  items,
  value,
  onChange,
  layoutId,
  size = "md",
  className,
}: {
  label: string;
  items: Item<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const move = (dir: 1 | -1) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === value);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full rounded-md border border-line bg-surface-2 p-0.5", className)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative min-w-0 flex-1 rounded-[5px] px-3 font-medium whitespace-nowrap transition-colors disabled:opacity-40",
              size === "sm" ? "h-8 text-[13px]" : "h-10 text-sm",
              active ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {active && <motion.span layoutId={layoutId} transition={spring.snappy} className="absolute inset-0 rounded-[5px] border border-line-strong bg-surface shadow-sm" />}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
