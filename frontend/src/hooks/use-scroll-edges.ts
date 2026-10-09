"use client";

import * as React from "react";

/** Whether a scroll container has more content above or below, for scroll shadows. */
export function useScrollEdges(ref: React.RefObject<HTMLElement | null>): { top: boolean; bottom: boolean } {
  const [edges, setEdges] = React.useState({ top: false, bottom: false });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 2;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);
  return edges;
}
