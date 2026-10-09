"use client";

import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/use-session";
import { apiHost } from "@/lib/api/client";
import { SignIn } from "./account/sign-in";
import { useAccounts } from "./account/use-accounts";
import { Workspace } from "./workspace";

/** Checks the API first: unreachable, sign-in required, or the workspace. */
export function WorkspaceGate() {
  const accounts = useAccounts();
  const session = useSession();

  if (accounts.kind === "checking") {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-ink-muted">
        <h1 className="sr-only">Workspace</h1>
        <Spinner label="Connecting to the API" /> Connecting…
      </div>
    );
  }
  if (accounts.kind === "error") {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex w-full max-w-[520px] flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-panel">
          <Unplug aria-hidden className="size-6 text-unsupported-text" />
          <h1 className="m-0 font-display text-3xl font-normal">The API isn’t answering.</h1>
          <p className="m-0 text-sm leading-relaxed text-ink-muted">
            The workspace talks to the OmniDoc backend at <code className="font-mono text-ink">{apiHost()}</code>. Start it, then try again:
          </p>
          <pre className="m-0 overflow-x-auto rounded-md bg-surface-3 p-3 font-mono text-xs leading-relaxed text-ink">
            {"cd backend\n.venv/bin/uvicorn src.api.main:app --port 8000"}
          </pre>
          <Button variant="primary" className="self-start" onClick={accounts.retry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (accounts.enabled && !session) return <SignIn />;
  return <Workspace />;
}
