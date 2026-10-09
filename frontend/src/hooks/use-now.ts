"use client";

import { useEffect, useState } from "react";

/** performance.now(), refreshed every `ms` while `active`. Stops when inactive or the tab is hidden. */
export function useNow(active: boolean, ms = 100): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!id) id = setInterval(() => setNow(performance.now()), ms);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, ms]);
  return now;
}
