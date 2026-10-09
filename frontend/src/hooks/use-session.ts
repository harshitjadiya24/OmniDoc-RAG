"use client";

import { useSyncExternalStore } from "react";
import { getSession, onSessionChange } from "@/lib/api/session";
import type { Session } from "@/lib/api/schemas";

export function useSession(): Session | null {
  return useSyncExternalStore(onSessionChange, getSession, () => null);
}
