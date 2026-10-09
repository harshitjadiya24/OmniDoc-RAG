"use client";

import * as React from "react";
import { ArrowUpRight, FileText, MessageSquareText, Trash2 } from "lucide-react";
import { Badge, VersionBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { docTypeLabel } from "@/lib/api/documents";
import type { LibraryDocument } from "@/lib/api/schemas";
import { decodeEntities, formatBytes, formatDate, plural } from "@/lib/format";
import { useConversation } from "@/stores/conversation";
import { useEvidence } from "@/stores/evidence";
import { useLibrary } from "@/stores/library";
import { useUi } from "@/stores/ui";
import { DocumentEditor } from "./document-editor";
import { isVersioned } from "./versioning";

type Tab = "overview" | "details";

export function DocumentDrawer() {
  const openId = useLibrary((s) => s.openId);
  const documents = useLibrary((s) => s.documents);
  const setOpen = useLibrary((s) => s.setOpen);
  const doc = documents.find((d) => d.id === openId) ?? null;
  const [tab, setTab] = React.useState<Tab>("overview");

  return (
    <Sheet
      open={doc !== null}
      onOpenChange={(open) => {
        if (!open) {
          setOpen(null);
          setTab("overview");
        }
      }}
      title={doc ? decodeEntities(doc.title) : "Document"}
      description={doc ? `${doc.id} · ${doc.filename}` : undefined}
      width={560}
    >
      {doc && (
        <div className="flex flex-col gap-5 p-5">
          <Segmented label="Document view" layoutId="doc-tab" items={[{ value: "overview", label: "Overview" }, { value: "details", label: "Edit details" }]} value={tab} onChange={setTab} size="sm" />
          {tab === "overview" ? <Overview doc={doc} all={documents} /> : <DocumentEditor key={doc.id} doc={doc} />}
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2.5">
      <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="m-0 mt-0.5 truncate font-mono text-sm text-ink tabular">{value}</dd>
    </div>
  );
}

function Overview({ doc, all }: { doc: LibraryDocument; all: LibraryDocument[] }) {
  const { setOpen, remove, toggle, setTask } = useLibrary.getState();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const type = docTypeLabel(doc.doc_type);

  const ask = (question: string) => {
    if (!useLibrary.getState().selectedIds.includes(doc.id)) toggle(doc.id);
    setTask("ask");
    setOpen(null);
    useUi.getState().setLibrarySheet(false);
    void useConversation.getState().submit(question);
  };

  const viewPdf = () => {
    setOpen(null);
    useEvidence.getState().openPdf({ docId: doc.id, page: 1, title: decodeEntities(doc.title), passage: null, evidence: null });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {type && <Badge>{type}</Badge>}
        {isVersioned(doc, all) && <VersionBadge status={doc.status} supersededBy={doc.superseded_by} />}
        {doc.issuer && <Badge>{doc.issuer}</Badge>}
        {doc.reference && <Badge className="font-mono">{doc.reference}</Badge>}
      </div>

      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Pages" value={doc.page_count} />
        <Stat label="Passages" value={doc.chunk_count} />
        <Stat label="Size" value={formatBytes(doc.size_bytes)} />
        <Stat label="Date" value={formatDate(doc.doc_date) ?? "—"} />
      </dl>

      {doc.type_signals.length > 0 && (
        <section aria-labelledby="why-type" className="flex flex-col gap-2">
          <h3 id="why-type" className="eyebrow m-0">
            Why “{type}”
          </h3>
          <p className="m-0 text-sm text-ink-muted">
            Matched {plural(doc.type_signals.length, "phrase")} in the opening pages ({Math.round(doc.type_confidence * 100)}% of all type signals):
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {doc.type_signals.map((s) => (
              <li key={s} className="rounded-[4px] bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.example_questions.length > 0 && (
        <section aria-labelledby="examples" className="flex flex-col gap-2">
          <h3 id="examples" className="eyebrow m-0">
            Questions this document answers
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {doc.example_questions.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => ask(q)}
                  className="group flex min-h-11 w-full items-center gap-2.5 rounded-md border border-line bg-surface-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:border-verified/50 hover:bg-verified-wash"
                >
                  <MessageSquareText aria-hidden className="size-4 shrink-0 text-ink-subtle group-hover:text-verified-text" />
                  <span className="min-w-0 flex-1 break-anywhere">{q}</span>
                  <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="summary" className="flex flex-col gap-2">
        <h3 id="summary" className="eyebrow m-0">
          Summary
        </h3>
        {doc.summary ? (
          <>
            <p className="m-0 text-xs text-ink-subtle">Written by the answer model when the document was uploaded. It is not page-checked.</p>
            <Markdown className="text-[14.5px]">{doc.summary}</Markdown>
          </>
        ) : (
          <p className="m-0 text-sm text-ink-muted">No summary was generated, usually because no answer model was available at upload time.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <Button variant="outline" onClick={viewPdf}>
          <FileText /> View PDF
        </Button>
        {confirming ? (
          <>
            <Button
              variant="inverse"
              className="bg-unsupported text-black"
              onClick={async () => {
                const e = await remove(doc.id);
                if (e) setError(e);
              }}
            >
              <Trash2 /> Delete permanently
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            <Trash2 /> Delete
          </Button>
        )}
        {error && (
          <p role="alert" className="m-0 basis-full text-sm text-unsupported-text">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
