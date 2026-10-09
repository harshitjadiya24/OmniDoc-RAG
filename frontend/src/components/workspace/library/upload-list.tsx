"use client";

import { AnimatePresence, motion } from "motion/react";
import { FileWarning, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duration, ease } from "@/lib/motion";
import { useLibrary } from "@/stores/library";

/** In-flight uploads with the server's current stage, and failed ones with their reason. */
export function UploadList() {
  const uploads = useLibrary((s) => s.uploads);
  const dismiss = useLibrary((s) => s.dismissUpload);
  return (
    <ul aria-label="Uploads" className="m-0 flex list-none flex-col gap-2 p-0 empty:hidden">
      <AnimatePresence initial={false}>
        {uploads.map((u) => (
          <motion.li
            key={u.key}
            layout="position"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: duration.base, ease: ease.outExpo }}
            className="relative min-w-0 overflow-hidden rounded-md border border-line bg-surface p-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              {u.status === "error" && <FileWarning aria-hidden className="mt-0.5 size-4 shrink-0 text-unsupported-text" />}
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-sm font-medium text-ink" title={u.name} data-truncated>
                  {u.name}
                </p>
                <p className={u.status === "error" ? "m-0 mt-0.5 text-xs text-unsupported-text break-anywhere" : "m-0 mt-0.5 text-xs text-ink-muted"} aria-live="polite">
                  {u.status === "error" ? u.error : u.stage}
                </p>
              </div>
              {u.status === "error" && (
                <Button variant="ghost" size="sm" className="-my-1 -mr-1 size-8 px-0" aria-label={`Dismiss ${u.name}`} onClick={() => dismiss(u.key)}>
                  <X />
                </Button>
              )}
            </div>
            {u.status === "uploading" && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-verified-wash">
                <span className="block h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-verified to-transparent" />
              </span>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
