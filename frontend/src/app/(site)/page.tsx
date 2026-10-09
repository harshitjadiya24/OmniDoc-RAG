import { ButtonLink } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <section aria-labelledby="hero-title" className="hairline-grid relative">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-[clamp(1rem,3vw,2.5rem)] py-[clamp(4rem,10vw,8rem)]">
        <p className="eyebrow m-0">Grounded document Q&amp;A</p>
        <h1 id="hero-title" className="m-0 max-w-[14ch] font-display text-[clamp(3rem,1.6rem+6vw,6.5rem)] leading-[0.95] font-normal tracking-[-0.02em]">
          Answers that <em className="text-verified-text">show their work.</em>
        </h1>
        <p className="m-0 max-w-[56ch] text-lg leading-relaxed text-ink-muted">
          Upload PDFs and ask in plain English. Every statement cites its page, every citation is checked against that page, and missing
          evidence gets a refusal instead of a guess.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/app" variant="primary" size="lg">
            Open the workspace
          </ButtonLink>
          <ButtonLink href="/#pipeline" variant="outline" size="lg">
            See how it works
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
