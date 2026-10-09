import { fetchEventSource } from "@microsoft/fetch-event-source";
import { API_URL } from "@/lib/env";
import { apiHost, UNREACHABLE } from "./client";
import { StreamEventSchema, type AskPayload, type StreamEvent } from "./schemas";
import { authHeaders } from "./session";

export type StreamErrorKind = "network" | "http" | "content_type" | "early_close" | "idle_timeout";

export class StreamError extends Error {
  constructor(
    message: string,
    readonly kind: StreamErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "StreamError";
  }
}

export const IDLE_MS = 60_000;
const MAX_RETRIES = 2;

type Handlers = {
  onEvent: (event: StreamEvent) => void;
  /** Called at most once. Not called when the caller aborts. */
  onError: (error: StreamError) => void;
  signal: AbortSignal;
};

/** Extracts FastAPI's `detail` from an error body, if there is one. */
async function detailOf(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "detail" in body && typeof body.detail === "string") return body.detail;
  } catch {
    /* not JSON */
  }
  return null;
}

/**
 * POST /ask/stream as Server-Sent Events.
 *
 * - Every event is validated; malformed or unknown events are dropped (logged in development).
 * - Up to two retries with backoff, only before the first event arrives; never after.
 * - A close without `done` (or `error`) is reported as an early close; the caller keeps the partial answer.
 * - Sixty seconds without data stops the stream.
 */
export async function streamAsk(payload: AskPayload, { onEvent, onError, signal }: Handlers): Promise<void> {
  const inner = new AbortController();
  const abortInner = () => inner.abort();
  signal.addEventListener("abort", abortInner);

  let received = false;
  let finished = false;
  let failed = false;
  let retries = 0;
  let idle: ReturnType<typeof setTimeout> | null = null;

  const fail = (error: StreamError) => {
    if (failed || signal.aborted) return;
    failed = true;
    onError(error);
  };
  const resetIdle = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      fail(new StreamError("No data arrived for 60 seconds, so the answer was stopped.", "idle_timeout"));
      inner.abort();
    }, IDLE_MS);
  };

  try {
    await fetchEventSource(`${API_URL}/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...authHeaders() },
      body: JSON.stringify(payload),
      signal: inner.signal,
      openWhenHidden: true,
      async onopen(res) {
        if (!res.ok) {
          const detail = await detailOf(res);
          throw new StreamError(detail ?? `The OmniDoc API at ${apiHost()} answered ${res.status}.`, "http", res.status);
        }
        if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
          throw new StreamError("The API did not answer with an event stream.", "content_type", res.status);
        }
        resetIdle();
      },
      onmessage(msg) {
        resetIdle();
        received = true;
        if (!msg.data) return;
        let raw: unknown;
        try {
          raw = JSON.parse(msg.data);
        } catch {
          if (process.env.NODE_ENV === "development") console.debug("[stream] non-JSON event dropped", msg.data);
          return;
        }
        const parsed = StreamEventSchema.safeParse(raw);
        if (!parsed.success) {
          if (process.env.NODE_ENV === "development") console.debug("[stream] malformed event dropped", raw);
          return;
        }
        if (parsed.data.type === "done" || parsed.data.type === "error") finished = true;
        onEvent(parsed.data);
      },
      onclose() {
        if (!finished) fail(new StreamError("The connection ended before the answer finished. Here is what arrived.", "early_close"));
      },
      onerror(err: unknown) {
        if (inner.signal.aborted) throw err;
        if (err instanceof StreamError) {
          fail(err);
          throw err;
        }
        if (!received && retries < MAX_RETRIES) {
          retries += 1;
          return 500 * retries;
        }
        fail(new StreamError(UNREACHABLE(), "network"));
        throw err;
      },
    });
  } catch {
    /* every failure has already been reported through onError */
  } finally {
    if (idle) clearTimeout(idle);
    signal.removeEventListener("abort", abortInner);
  }
}
