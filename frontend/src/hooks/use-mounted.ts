"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server render and hydration, true afterwards. No effect, no extra render pass. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
