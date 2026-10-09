import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="eyebrow m-0">Error 404</p>
      <h1 className="m-0 font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-normal">
        No evidence for <em>this page.</em>
      </h1>
      <p className="m-0 max-w-[44ch] text-ink-muted">We would rather say so than guess. The address may be mistyped or the page moved.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/" variant="outline">
          Back to home
        </ButtonLink>
        <ButtonLink href="/app" variant="primary">
          Open workspace
        </ButtonLink>
      </div>
    </main>
  );
}
