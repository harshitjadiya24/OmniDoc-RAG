import { z } from "zod";
import { failure, request, sendJson } from "./client";
import { SessionSchema, type ProviderInfo, ProvidersSchema, type Session } from "./schemas";

/** Whether the server has accounts turned on. Servers without the endpoint have none. */
export async function authEnabled(): Promise<boolean> {
  const res = await request("/auth/config");
  if (res.status === 404) return false;
  if (!res.ok) throw await failure(res);
  return z.object({ auth_enabled: z.boolean() }).parse(await res.json()).auth_enabled;
}

export function signIn(kind: "login" | "register", email: string, password: string): Promise<Session> {
  return sendJson(`/auth/${kind}`, "POST", { email, password }, SessionSchema);
}

export async function listProviders(signal?: AbortSignal): Promise<{ default: string; providers: ProviderInfo[] }> {
  const res = await request("/llm/providers", { signal });
  if (!res.ok) throw await failure(res);
  return ProvidersSchema.parse(await res.json());
}
