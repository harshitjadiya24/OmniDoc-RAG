import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { SampleReplay } from "./sample-replay";

const PROOF = ["Every statement cites a page", "Every citation is page-checked", "No evidence, no answer"];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden className="hairline-grid absolute inset-0 [mask-image:radial-gradient(80%_70%_at_30%_30%,black,transparent_75%)]" />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-[clamp(2.5rem,6vw,5rem)] px-[clamp(1rem,3vw,2.5rem)] pt-[clamp(3rem,8vw,6.5rem)] pb-[clamp(4rem,9vw,7rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-7">
          <Reveal>
            <p className="eyebrow m-0 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-verified/40 bg-verified-wash px-2 py-0.5 text-verified-text">Grounded RAG</span>
              for PDFs you upload
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 id="hero-title" className="m-0 font-display text-[clamp(3.1rem,1.4rem+6.6vw,7rem)] leading-[0.92] font-normal tracking-[-0.025em]">
              Answers that <em className="text-verified-text">show their work.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="m-0 max-w-[52ch] text-[clamp(1.05rem,0.95rem+0.4vw,1.25rem)] leading-relaxed text-ink-muted">
              Ask contracts, papers, reports and regulations in plain English. Each statement cites the page it came from, each citation is checked against that page, and when the
              evidence isn’t there you get a refusal, not a guess.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="flex flex-wrap gap-3">
            <ButtonLink href="/app" variant="primary" size="lg">
              Open the workspace <ArrowRight />
            </ButtonLink>
            <ButtonLink href="/#verification" variant="outline" size="lg">
              How citations are checked
            </ButtonLink>
          </Reveal>
          <Reveal delay={0.2}>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-ink-muted">
              {PROOF.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span aria-hidden className="size-1.5 rounded-full bg-verified" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.15} className="min-w-0">
          <SampleReplay />
        </Reveal>
      </div>
    </section>
  );
}
