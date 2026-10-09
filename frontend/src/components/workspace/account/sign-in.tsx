"use client";

import * as React from "react";
import { motion } from "motion/react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { signIn } from "@/lib/api/auth";
import { setSession } from "@/lib/api/session";
import { duration, ease } from "@/lib/motion";

const FIELD = "h-11 w-full rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-ink focus:border-verified focus:outline-none";

/** Shown when the server has accounts on and nobody is signed in. Each account has a private library. */
export function SignIn() {
  const [kind, setKind] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSession(await signIn(kind, email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hairline-grid flex flex-1 items-center justify-center p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.slow, ease: ease.outExpo }}
        className="flex w-full max-w-[400px] flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-panel"
        aria-labelledby="signin-title"
      >
        <div className="flex flex-col gap-2">
          <span aria-hidden className="grid size-10 place-items-center rounded-full bg-verified-wash text-verified-text">
            <LockKeyhole className="size-5" />
          </span>
          <h1 id="signin-title" className="m-0 font-display text-3xl font-normal">
            {kind === "login" ? "Welcome back." : "Create your library."}
          </h1>
          <p className="m-0 text-sm text-ink-muted">Your documents and chats are private to your account.</p>
        </div>
        <Segmented label="Account" layoutId="auth-kind" items={[{ value: "login", label: "Sign in" }, { value: "register", label: "Create account" }]} value={kind} onChange={setKind} size="sm" className="w-full" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-email" className="text-sm font-medium">
            Email
          </label>
          <input id="auth-email" type="email" autoComplete="email" required className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={kind === "login" ? "current-password" : "new-password"}
            required
            minLength={kind === "register" ? 10 : undefined}
            className={FIELD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={kind === "register" ? "auth-password-hint" : undefined}
          />
          {kind === "register" && (
            <p id="auth-password-hint" className="m-0 text-xs text-ink-subtle">
              At least 10 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="m-0 text-sm text-unsupported-text">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? "One moment…" : kind === "login" ? "Sign in" : "Create account"}
        </Button>
      </motion.form>
    </div>
  );
}
