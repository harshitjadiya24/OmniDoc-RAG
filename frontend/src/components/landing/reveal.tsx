"use client";

import type * as React from "react";
import { motion } from "motion/react";
import { duration, ease } from "@/lib/motion";

/** Fades and lifts content in once as it scrolls into view. Opacity only under reduced motion. */
export function Reveal({ children, delay = 0, className, as = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: duration.cinematic, ease: ease.outExpo, delay }}
    >
      {children}
    </Comp>
  );
}
