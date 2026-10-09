import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "inverse" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-verified text-on-verified hover:brightness-105 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-12px_var(--glow)]",
  inverse: "bg-inverse text-on-inverse hover:opacity-90",
  outline: "border border-line-strong bg-surface/60 text-ink hover:bg-surface-3",
  ghost: "text-ink-muted hover:bg-surface-3 hover:text-ink",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
  icon: "size-11 justify-center",
};

export function buttonClasses({ variant = "outline", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(
    "inline-flex max-w-full shrink-0 select-none items-center justify-center rounded-md font-medium whitespace-nowrap",
    "transition-[transform,background-color,color,opacity,filter] duration-200 ease-[var(--ease-out)]",
    "hover:scale-[1.02] active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />;
});

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
