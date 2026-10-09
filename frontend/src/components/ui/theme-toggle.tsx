"use client";

import type * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "./button";

/** Theme switch with a circular reveal through the View Transitions API where supported. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const reduced = useReducedMotion();
  const mounted = useMounted();

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = isDark ? "light" : "dark";
    if (reduced || typeof document.startViewTransition !== "function") {
      setTheme(next);
      return;
    }
    const { clientX: x, clientY: y } = e;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => setTheme(next));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => undefined);
  };

  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} title={label}>
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
