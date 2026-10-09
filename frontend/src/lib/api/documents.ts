import { z } from "zod";
import { API_URL } from "@/lib/env";
import { ApiError, enc, failure, getJson, request, sendJson } from "./client";
import { DocumentSchema, UploadJobSchema, type DocType, type DocumentPatch, type LibraryDocument } from "./schemas";

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  contract: "Contract",
  research_paper: "Research paper",
  financial_report: "Financial report",
  regulation: "Regulation",
  manual: "Manual",
  other: "Other",
};

export function docTypeLabel(value: string | undefined | null): string | null {
  return value && value in DOC_TYPE_LABEL ? DOC_TYPE_LABEL[value as DocType] : null;
}

export function listDocuments(signal?: AbortSignal): Promise<LibraryDocument[]> {
  return getJson("/documents", z.array(DocumentSchema), { signal });
}

export const POLL_MS = 800;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * Uploads a PDF. The server answers 202 with a job and indexes in the background;
 * `onStage` receives each stage ("Embedding 70 passages") until the job finishes.
 */
export async function uploadDocument(file: File, onStage?: (stage: string) => void, signal?: AbortSignal): Promise<LibraryDocument> {
  const form = new FormData();
  form.append("file", file);
  const res = await request("/documents", { method: "POST", body: form, signal });
  if (!res.ok) throw await failure(res);
  if (res.status !== 202) return DocumentSchema.parse(await res.json());
  let job = UploadJobSchema.parse(await res.json());
  while (job.status === "queued" || job.status === "processing") {
    onStage?.(job.stage);
    await sleep(POLL_MS, signal);
    job = await getJson(`/documents/jobs/${enc(job.id)}`, UploadJobSchema, { signal });
  }
  if (job.status === "failed" || !job.document) throw new ApiError(job.error ?? "Indexing failed.");
  return job.document;
}

export function updateDocument(id: string, patch: DocumentPatch): Promise<LibraryDocument> {
  return sendJson(`/documents/${enc(id)}`, "PATCH", patch, DocumentSchema);
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await request(`/documents/${enc(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await failure(res);
}

export function documentFileUrl(id: string): string {
  return `${API_URL}/documents/${enc(id)}/file`;
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
