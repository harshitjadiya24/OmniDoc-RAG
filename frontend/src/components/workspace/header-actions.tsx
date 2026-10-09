"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Command as CommandIcon } from "lucide-react";
import { useLibrary } from "@/stores/library";
import { AccountMenu } from "./account/account-menu";
import { UPLOAD_INPUT_ID } from "./command-palette";

const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });

/** ⌘K palette trigger, a hidden upload input the palette can open, and the account menu. */
export function HeaderActions() {
  const [open, setOpen] = React.useState(false);
  const [used, setUsed] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setUsed(true);
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <CommandIcon aria-hidden className="size-3.5" />
        <span className="hidden sm:inline">Search & actions</span>
        <kbd className="hidden rounded border border-line px-1 font-mono text-[11px] md:inline">⌘K</kbd>
      </button>
      <input
        id={UPLOAD_INPUT_ID}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length) void useLibrary.getState().upload(files);
          e.target.value = "";
        }}
      />
      <AccountMenu />
      {used && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
