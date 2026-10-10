import { z } from "zod";

/*
 * The backend contract, validated at the edge. Every response and every SSE
 * event passes through these schemas; nothing unvalidated reaches the UI.
 */

export const DOC_TYPES = ["contract", "research_paper", "financial_report", "regulation", "manual", "other"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const RetrievalModeSchema = z.enum(["dense", "bm25", "hybrid"]);
export type RetrievalMode = z.infer<typeof RetrievalModeSchema>;

export const ProviderIdSchema = z.enum(["ollama", "openrouter", "mistral", "groq", "gemini"]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export type Task = "ask" | "compare";

export const DocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  title: z.string(),
  page_count: z.number(),
  chunk_count: z.number(),
  size_bytes: z.number(),
  uploaded_at: z.string(),
  doc_type: z.enum(DOC_TYPES).catch("other"),
  type_confidence: z.number().default(0),
  type_signals: z.array(z.string()).default([]),
  issuer: z.string().nullable().default(null),
  doc_date: z.string().nullable().default(null),
  reference: z.string().nullable().default(null),
  supersedes: z.array(z.string()).default([]),
  edited: z.array(z.string()).default([]),
  ocr_pages: z.number().default(0),
  summary: z.string().nullable().default(null),
  example_questions: z.array(z.string()).default([]),
  status: z.enum(["active", "superseded"]).default("active"),
  superseded_by: z.string().nullable().default(null),
  already_indexed: z.boolean().optional(),
});
export type LibraryDocument = z.infer<typeof DocumentSchema>;

export type DocumentPatch = Partial<{
  title: string;
  doc_type: DocType;
  issuer: string | null;
  doc_date: string | null;
  reference: string | null;
  supersedes: string[];
}>;

export const UploadJobSchema = z.object({
  id: z.string(),
  filename: z.string().optional(),
  status: z.enum(["queued", "processing", "done", "failed"]),
  stage: z.string(),
  document: DocumentSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});

export const SourceSchema = z.object({
  /** The backend keeps the historical field name; for uploads it is the document ID. */
  circular_id: z.string(),
  title: z.string(),
  /** Nearest section heading of the passage. */
  clause_id: z.string().nullable(),
  page: z.number().nullable(),
  status: z.enum(["active", "superseded"]).catch("active"),
  superseded_by: z.string().nullable().optional(),
  origin: z.literal("upload").optional(),
  /** True when the document takes part in a supersedes edge, so its status means something. */
  versioned: z.boolean().optional(),
  doc_type: z.string().optional(),
  text: z.string(),
  date: z.string(),
});
export type Source = z.infer<typeof SourceSchema>;

export const CHECK_STATUSES = ["supported", "partial", "unsupported", "not_found", "unchecked"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/** Word-overlap check of one citation against the full text of its cited page. A heuristic, not proof. */
export const CitationCheckSchema = z.object({
  doc_id: z.string(),
  page: z.number().nullable(),
  status: z.enum(CHECK_STATUSES),
  coverage: z.number().nullable(),
  claim: z.string(),
  evidence: z.string().nullable(),
});
export type CitationCheck = z.infer<typeof CitationCheckSchema>;

export const RefusalSchema = z.object({
  title: z.string(),
  message: z.string(),
  suggestions: z.array(z.string()).default([]),
});
export type Refusal = z.infer<typeof RefusalSchema>;

export const PlanSchema = z.object({
  type: z.literal("plan"),
  mode: z.enum(["single", "multi", "compare"]),
  reason: z.string(),
  documents: z.array(z.object({ id: z.string(), title: z.string(), label: z.string().nullable(), passages: z.number() })),
  contributing: z.array(z.string()),
  retrieval: z.object({ mode: RetrievalModeSchema, rerank: z.boolean(), rewritten: z.string().nullable() }).optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const UsageSchema = z.object({
  latency_ms: z.number(),
  passages_checked: z.number().optional(),
  passages_used: z.number().optional(),
  model: z.string().optional(),
  citations_resolved: z.number().optional(),
  citations_total: z.number().optional(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const STAGES = ["understanding", "searching", "reranking", "drafting"] as const;
export type StageName = (typeof STAGES)[number];

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stage"), name: z.string() }),
  PlanSchema,
  z.object({ type: z.literal("sources"), items: z.array(SourceSchema) }),
  z.object({ type: z.literal("token"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    refused: z.boolean(),
    usage: UsageSchema,
    refusal: RefusalSchema.optional(),
    citations: z.array(CitationCheckSchema).optional(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export type AskPayload = {
  question: string;
  mode: RetrievalMode;
  rerank: boolean;
  rewrite: boolean;
  document_ids: string[];
  task: Task;
  provider?: ProviderId;
  chat_id?: string | null;
};

export const ChatMessageSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  refused: z.boolean(),
  sources: z.array(SourceSchema).catch([]),
  citations: z.array(CitationCheckSchema).catch([]),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number(),
  messages: z.array(ChatMessageSchema).default([]),
});
export type Chat = z.infer<typeof ChatSchema>;

export const ProviderSchema = z.object({
  id: ProviderIdSchema,
  label: z.string(),
  model: z.string(),
  available: z.boolean(),
  reason: z.string().nullable(),
  local: z.boolean(),
});
export type ProviderInfo = z.infer<typeof ProviderSchema>;

export const ProvidersSchema = z.object({ default: z.string(), providers: z.array(ProviderSchema) });

export const SessionSchema = z.object({ token: z.string(), email: z.string() });
export type Session = z.infer<typeof SessionSchema>;
