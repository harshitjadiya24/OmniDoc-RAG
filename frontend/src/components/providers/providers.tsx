"use client";

import type * as React from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
