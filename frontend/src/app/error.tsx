"use client";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="eyebrow m-0">Something broke</p>
      <h1 className="m-0 font-display text-4xl font-normal">This view hit an unexpected error.</h1>
      <p className="m-0 max-w-[44ch] text-ink-muted">Your documents and chats are stored on the server and are not affected.</p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
