"use client";

import * as React from "react";
import Lenis from "lenis";
import { useReducedMotion } from "motion/react";

/** Lenis on the landing page only; off under reduced motion. In-page anchors stay native-smooth. */
export function SmoothScroll() {
  const reduced = useReducedMotion();
  React.useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -72 }, lerp: 0.12 });
    return () => lenis.destroy();
  }, [reduced]);
  return null;
}
