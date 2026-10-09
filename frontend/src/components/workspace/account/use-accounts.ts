"use client";

import * as React from "react";
import { authEnabled } from "@/lib/api/auth";

type AccountsState = { kind: "checking" } | { kind: "ready"; enabled: boolean } | { kind: "error"; message: string };

/** Whether this server has accounts turned on. */
export function useAccounts(): AccountsState & { retry: () => void } {
  const [state, setState] = React.useState<AccountsState>({ kind: "checking" });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    authEnabled()
      .then((enabled) => !cancelled && setState({ kind: "ready", enabled }))
      .catch((e: unknown) => !cancelled && setState({ kind: "error", message: e instanceof Error ? e.message : "The API could not be reached." }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
