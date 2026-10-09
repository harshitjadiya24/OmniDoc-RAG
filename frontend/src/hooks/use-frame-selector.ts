"use client";

import { useEffect, useState } from "react";
import { useConversation } from "@/stores/conversation";

type State = ReturnType<typeof useConversation.getState>;

/**
 * Subscribes to the conversation store but re-renders at most once per animation
 * frame. Tokens can arrive faster than the screen refreshes; batching keeps
 * streaming free of long tasks. `selector` must be stable (module scope).
 */
export function useFrameSelector<T>(selector: (s: State) => T): T {
  const [value, setValue] = useState(() => selector(useConversation.getState()));
  useEffect(() => {
    let raf = 0;
    const flush = () => {
      raf = 0;
      setValue(selector(useConversation.getState()));
    };
    const unsubscribe = useConversation.subscribe(() => {
      if (!raf) raf = requestAnimationFrame(flush);
    });
    raf = requestAnimationFrame(flush);
    return () => {
      unsubscribe();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selector]);
  return value;
}
