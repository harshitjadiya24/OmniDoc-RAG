import { SessionSchema, type Session } from "./schemas";

/** The signed-in session (accounts mode only), kept in localStorage per browser. */
const KEY = "omnidoc-session";

let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Session | null {
  if (!loaded) {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      const parsed = SessionSchema.safeParse(raw ? JSON.parse(raw) : null);
      session = parsed.success ? parsed.data : null;
    } catch {
      session = null;
    }
  }
  return session;
}

export function getSession(): Session | null {
  return typeof window === "undefined" ? null : read();
}

export function setSession(next: Session | null): void {
  session = next;
  loaded = true;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lasts for this page only */
  }
  listeners.forEach((fn) => fn());
}

export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Authorization header for API calls; empty when signed out or accounts are off. */
export function authHeaders(): Record<string, string> {
  const s = getSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}
