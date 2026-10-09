"use client";

import * as S from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

type SwitchProps = { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string; hint?: string; disabled?: boolean; id: string };

/** A labelled switch; the whole row is the 44px target. */
export function Switch({ checked, onCheckedChange, label, hint, disabled, id }: SwitchProps) {
  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between gap-4">
      <label htmlFor={id} className={cn("min-w-0 cursor-pointer", disabled && "cursor-not-allowed opacity-50")}>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </label>
      <S.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-6 w-10 shrink-0 rounded-full border border-line-strong bg-surface-3 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-verified disabled:opacity-50"
      >
        <S.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-ink shadow transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-on-verified" />
      </S.Root>
    </div>
  );
}
