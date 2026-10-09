import { z } from "zod";
import { API_URL } from "@/lib/env";
import { authHeaders, setSession } from "./session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiHost(): string {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL;
  }
}

export const UNREACHABLE = () => `Can't reach the OmniDoc API at ${apiHost()}. Check that the backend is running.`;

const DetailSchema = z.object({ detail: z.union([z.string(), z.array(z.object({ msg: z.string() }))]) });

/** Turns a failed response into a readable error, using FastAPI's `detail` when present. */
export async function failure(res: Response): Promise<ApiError> {
  let detail = `The server answered ${res.status}.`;
  try {
    const parsed = DetailSchema.safeParse(await res.json());
    if (parsed.success) {
      const d = parsed.data.detail;
      detail = typeof d === "string" ? d : d.map((e) => e.msg.replace(/^Value error,\s*/, "")).join(" ");
    }
  } catch {
    /* non-JSON error body: keep the status message */
  }
  return new ApiError(detail, res.status);
}

/** fetch against the API with the session header. A 401 forgets the session so the sign-in form returns. */
export async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(), ...init?.headers } });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(UNREACHABLE());
  }
  if (res.status === 401 && authHeaders().Authorization) setSession(null);
  return res;
}

export async function getJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (!res.ok) throw await failure(res);
  return schema.parse(await res.json());
}

export async function sendJson<T>(path: string, method: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return getJson(path, schema, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export const enc = encodeURIComponent;
