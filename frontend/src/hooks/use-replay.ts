"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { useMounted } from "./use-mounted";

/**
 * A looping clock for scripted demos: milliseconds since the loop started.
 * It only runs while the element is on screen and the tab is visible, and
 * under reduced motion it jumps straight to `still` (the finished frame).
 */
export function useReplay(ref: React.RefObject<HTMLElement | null>, length: number, still: number, tick = 50): { t: number; restart: () => void } {
  // The server can't know the motion preference, so the first render always matches the server's frame.
  const prefersReduced = useReducedMotion();
  const mounted = useMounted();
  const reduced = mounted && prefersReduced === true;
  const [t, setT] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const startRef = React.useRef<number | null>(null);
  const offsetRef = React.useRef(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  React.useEffect(() => {
    if (reduced || !visible) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const run = () => {
      if (id || document.hidden) return;
      startRef.current = performance.now() - offsetRef.current;
      id = setInterval(() => {
        const elapsed = (performance.now() - (startRef.current ?? 0)) % length;
        offsetRef.current = elapsed;
        setT(elapsed);
      }, tick);
    };
    const pause = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVisibility = () => (document.hidden ? pause() : run());
    run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced, visible, length, tick]);

  const restart = React.useCallback(() => {
    offsetRef.current = 0;
    startRef.current = performance.now();
    setT(0);
  }, []);

  return { t: reduced ? still : t, restart };
}
