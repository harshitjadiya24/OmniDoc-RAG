"use client";

import * as Popover from "@radix-ui/react-popover";
import { LogOut, UserRound } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { setSession } from "@/lib/api/session";

export function AccountMenu() {
  const session = useSession();
  if (!session) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Account: ${session.email}`} className="grid size-11 place-items-center rounded-md text-ink-muted hover:bg-surface-3 hover:text-ink">
          <UserRound className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="z-[60] w-64 rounded-xl border border-line bg-surface p-2 shadow-panel">
          <p className="m-0 px-2.5 pt-1.5 text-xs text-ink-subtle">Signed in as</p>
          <p className="m-0 truncate px-2.5 pb-2 text-sm text-ink" title={session.email}>
            {session.email}
          </p>
          <button
            type="button"
            onClick={() => {
              setSession(null);
              window.location.reload();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-sm text-ink hover:bg-surface-3"
          >
            <LogOut aria-hidden className="size-4" /> Sign out
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
