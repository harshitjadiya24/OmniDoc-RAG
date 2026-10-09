"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DOC_TYPE_LABEL } from "@/lib/api/documents";
import { DOC_TYPES, type DocType, type LibraryDocument } from "@/lib/api/schemas";
import { diff, formFrom, validate, type DocumentForm } from "@/lib/document-form";
import { useLibrary } from "@/stores/library";

const FIELD = "h-11 w-full min-w-0 rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-verified focus:outline-none";

function Field({ id, label, detected, hint, children }: { id: string; label: string; detected: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="text-[11px] text-ink-subtle">{detected ? "Detected from the PDF" : "Edited"}</span>
      </div>
      {children}
      {hint && <p className="m-0 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Correct what was detected. A new type re-chunks and re-embeds the document on the server. */
export function DocumentEditor({ doc }: { doc: LibraryDocument }) {
  const update = useLibrary((s) => s.update);
  const [form, setForm] = React.useState<DocumentForm>(() => formFrom(doc));
  const [status, setStatus] = React.useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const id = React.useId();
  const patch = diff(doc, form);
  const dirty = Object.keys(patch).length > 0;
  const problem = validate(form);
  const set = <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus({ kind: "idle" });
  };
  const detected = (field: string) => !doc.edited.includes(field);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      setStatus({ kind: "error", message: problem });
      return;
    }
    setStatus({ kind: "saving" });
    const error = await update(doc.id, patch);
    setStatus(error ? { kind: "error", message: error } : { kind: "saved" });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field id={`${id}-title`} label="Title" detected={detected("title")}>
        <input id={`${id}-title`} className={FIELD} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} required />
      </Field>
      <Field id={`${id}-type`} label="Document type" detected={detected("doc_type")} hint={patch.doc_type ? "Saving re-reads the original PDF with this type’s chunking rules." : undefined}>
        <select id={`${id}-type`} className={FIELD} value={form.doc_type} onChange={(e) => set("doc_type", e.target.value as DocType)}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-issuer`} label="Issuer" detected={detected("issuer")}>
          <input id={`${id}-issuer`} className={FIELD} value={form.issuer} onChange={(e) => set("issuer", e.target.value)} maxLength={200} />
        </Field>
        <Field id={`${id}-date`} label="Date" detected={detected("doc_date")}>
          <input id={`${id}-date`} type="date" className={FIELD} value={form.doc_date} onChange={(e) => set("doc_date", e.target.value)} />
        </Field>
      </div>
      <Field id={`${id}-ref`} label="Reference number" detected={detected("reference")}>
        <input id={`${id}-ref`} className={`${FIELD} font-mono`} value={form.reference} onChange={(e) => set("reference", e.target.value)} maxLength={120} />
      </Field>
      <Field
        id={`${id}-sup`}
        label="Supersedes"
        detected={detected("supersedes")}
        hint="One document ID (DOC-…) or reference number per line. Matching uploads are marked superseded and answers prefer this one."
      >
        <textarea
          id={`${id}-sup`}
          rows={3}
          className={`${FIELD} h-auto resize-y py-2.5 font-mono`}
          value={form.supersedes}
          onChange={(e) => set("supersedes", e.target.value)}
          placeholder="DOC-1A2B3C4D"
        />
      </Field>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!dirty || status.kind === "saving"}>
          {status.kind === "saving" ? (patch.doc_type ? "Re-indexing…" : "Saving…") : "Save changes"}
        </Button>
        {dirty && status.kind !== "saving" && (
          <Button variant="ghost" onClick={() => setForm(formFrom(doc))}>
            Reset
          </Button>
        )}
        <p role="status" className={status.kind === "error" ? "m-0 text-sm text-unsupported-text break-anywhere" : "m-0 text-sm text-verified-text"}>
          {status.kind === "error" ? status.message : status.kind === "saved" ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}
