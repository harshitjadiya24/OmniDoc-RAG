import type { LibraryDocument } from "@/lib/api/schemas";

/**
 * The same ordering the backend planner uses for Compare: by stated date when
 * both documents have one, otherwise by upload time. A is the earlier one.
 */
export function compareOrder(docs: LibraryDocument[]): LibraryDocument[] {
  if (docs.every((d) => d.doc_date)) return [...docs].sort((a, b) => (a.doc_date ?? "").localeCompare(b.doc_date ?? ""));
  return [...docs].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
}
