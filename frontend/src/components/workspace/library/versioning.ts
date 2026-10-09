import type { LibraryDocument } from "@/lib/api/schemas";

/**
 * Whether a document takes part in a supersedes edge, mirroring the backend's lineage rule:
 * an entry names another upload by ID or by reference number. Only then is "current" meaningful.
 */
export function isVersioned(doc: LibraryDocument, all: LibraryDocument[]): boolean {
  if (doc.status === "superseded") return true;
  const keys = new Map<string, string>();
  for (const d of all) {
    keys.set(d.id.toLowerCase(), d.id);
    if (d.reference) keys.set(d.reference.trim().toLowerCase(), d.id);
  }
  return doc.supersedes.some((entry) => {
    const target = keys.get(entry.trim().toLowerCase());
    return target !== undefined && target !== doc.id;
  });
}
