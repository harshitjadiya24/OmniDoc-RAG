import { vi } from "vitest";

/** Minimal browser globals for code that expects window and localStorage under Node. */
export function installBrowserGlobals(): void {
  const store = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = globalThis;
  g.document = { hidden: false, addEventListener: () => undefined, removeEventListener: () => undefined };
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

export const sse = (events: unknown[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

export function streamResponse(body: string, init: { status?: number; contentType?: string } = {}): Response {
  return new Response(new Blob([body]).stream(), {
    status: init.status ?? 200,
    headers: { "content-type": init.contentType ?? "text/event-stream" },
  });
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Routes fetch by "METHOD path-suffix"; unmatched calls fail the test loudly. */
export function mockFetch(routes: Record<string, (init?: RequestInit) => Response | Promise<Response>>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = Object.keys(routes).find((k) => {
      const [m, path] = k.split(" ");
      return m === method && url.endsWith(path);
    });
    if (!key) throw new Error(`Unmocked fetch: ${method} ${url}`);
    return routes[key](init);
  });
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}
