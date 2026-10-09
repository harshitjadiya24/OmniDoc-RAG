import type * as React from "react";
import { CircleCheck, CircleDashed, Contrast, FileQuestion, History, TriangleAlert, type LucideIcon } from "lucide-react";
import type { CheckStatus } from "@/lib/api/schemas";
import { CHECK_SHORT } from "@/lib/rag/checks";
import { cn } from "@/lib/utils";

type Tone = "verified" | "partial" | "unsupported" | "neutral" | "superseded" | "plain";

const TONE: Record<Tone, string> = {
  verified: "bg-verified-wash text-verified-text border-verified/30",
  partial: "bg-partial-wash text-partial-text border-partial/35",
  unsupported: "bg-unsupported-wash text-unsupported-text border-unsupported/35",
  neutral: "bg-neutral-wash text-neutral-text border-neutral/30",
  superseded: "bg-superseded-wash text-superseded-text border-superseded/35",
  plain: "bg-surface-2 text-ink-muted border-line",
};

export function Badge({ tone = "plain", icon: Icon, children, className, title }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] leading-4 font-medium", TONE[tone], className)}
    >
      {Icon && <Icon aria-hidden className="size-3 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export const CHECK_ICON: Record<CheckStatus, LucideIcon> = {
  supported: CircleCheck,
  partial: Contrast,
  unsupported: TriangleAlert,
  not_found: FileQuestion,
  unchecked: CircleDashed,
};

export const CHECK_TONE: Record<CheckStatus, Tone> = {
  supported: "verified",
  partial: "partial",
  unsupported: "unsupported",
  not_found: "neutral",
  unchecked: "neutral",
};

export function CheckBadge({ status, className }: { status: CheckStatus; className?: string }) {
  return (
    <Badge tone={CHECK_TONE[status]} icon={CHECK_ICON[status]} className={className}>
      {CHECK_SHORT[status]}
    </Badge>
  );
}

/** Version status, shown only for documents that take part in a supersedes edge. Icon plus word, never colour alone. */
export function VersionBadge({ status, supersededBy }: { status: "active" | "superseded"; supersededBy?: string | null }) {
  return status === "superseded" ? (
    <Badge tone="superseded" icon={History} title={supersededBy ? `Superseded by ${supersededBy}` : undefined}>
      Superseded
    </Badge>
  ) : (
    <Badge tone="verified" icon={CircleCheck}>
      Current version
    </Badge>
  );
}
