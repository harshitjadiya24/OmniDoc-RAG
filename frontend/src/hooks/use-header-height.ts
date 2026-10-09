"use client";

import * as React from "react";

/** Publishes the element's height as --header-h for sticky offsets and scroll padding. */
export function useHeaderHeight(ref: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--header-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}
