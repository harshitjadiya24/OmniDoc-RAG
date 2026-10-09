import type { DocType, DocumentPatch, LibraryDocument } from "@/lib/api/schemas";

export type DocumentForm = {
  title: string;
  doc_type: DocType;
  issuer: string;
  doc_date: string;
  reference: string;
  /** One document ID or reference number per line (commas also separate). */
  supersedes: string;
};

export function formFrom(doc: LibraryDocument): DocumentForm {
  return {
    title: doc.title,
    doc_type: doc.doc_type,
    issuer: doc.issuer ?? "",
    doc_date: doc.doc_date ?? "",
    reference: doc.reference ?? "",
    supersedes: doc.supersedes.join("\n"),
  };
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const orNull = (s: string) => clean(s) || null;

export function parseSupersedes(text: string): string[] {
  return Array.from(new Set(text.split(/[\n,]/).map(clean).filter(Boolean)));
}

/** The user-facing problem with the form, or null when it can be saved. */
export function validate(form: DocumentForm): string | null {
  if (!clean(form.title)) return "A title is required.";
  if (form.doc_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.doc_date)) return "Use a full date (YYYY-MM-DD).";
  const entries = parseSupersedes(form.supersedes);
  if (entries.length > 20) return "List at most 20 superseded documents.";
  if (entries.some((e) => e.length > 120)) return "Each superseded entry must be 120 characters or fewer.";
  return null;
}

/** Only the fields that changed, so untouched values stay "detected from the PDF". */
export function diff(doc: LibraryDocument, form: DocumentForm): DocumentPatch {
  const patch: DocumentPatch = {};
  if (clean(form.title) !== doc.title) patch.title = clean(form.title);
  if (form.doc_type !== doc.doc_type) patch.doc_type = form.doc_type;
  if (orNull(form.issuer) !== doc.issuer) patch.issuer = orNull(form.issuer);
  if ((form.doc_date || null) !== doc.doc_date) patch.doc_date = form.doc_date || null;
  if (orNull(form.reference) !== doc.reference) patch.reference = orNull(form.reference);
  const supersedes = parseSupersedes(form.supersedes);
  if (supersedes.join("\n") !== doc.supersedes.join("\n")) patch.supersedes = supersedes;
  return patch;
}
