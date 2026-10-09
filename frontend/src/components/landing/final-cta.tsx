import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden border-t border-line">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_100%,var(--glow),transparent_70%)]" />
      <Reveal className="relative mx-auto flex max-w-[1280px] flex-col items-center gap-7 px-[clamp(1rem,3vw,2.5rem)] py-[clamp(5rem,12vw,10rem)] text-center">
        <h2 id="cta-title" className="m-0 max-w-[16ch] font-display text-[clamp(2.75rem,1.4rem+5vw,6rem)] leading-[0.95] font-normal tracking-[-0.02em]">
          Upload a PDF. <em className="text-verified-text">Check the answer.</em>
        </h2>
        <p className="m-0 max-w-[48ch] text-lg text-ink-muted">Run the backend locally, open the workspace, and ask your first question in under a minute.</p>
        <ButtonLink href="/app" variant="primary" size="lg">
          Open the workspace <ArrowRight />
        </ButtonLink>
      </Reveal>
    </section>
  );
}
