import { Reveal } from "./reveal";

/** Facts about the system as built. Each one is checkable in the backend source. */
const FACTS = [
  { value: "4", label: "streamed pipeline stages", detail: "plan · retrieve · rank · draft" },
  { value: "3", label: "retrieval modes", detail: "BM25, dense, hybrid RRF" },
  { value: "5", label: "citation verdicts", detail: "supported to page missing" },
  { value: "6", label: "document types", detail: "each with its own chunking" },
  { value: "0", label: "documents sent to a cloud", detail: "on the default local stack" },
];

export function FactsStrip() {
  return (
    <section aria-label="The system in numbers" className="border-t border-line bg-surface-2">
      <ul className="mx-auto m-0 grid max-w-[1280px] list-none grid-cols-2 gap-px p-0 sm:grid-cols-3 lg:grid-cols-5">
        {FACTS.map((f, i) => (
          <Reveal as="li" key={f.label} delay={i * 0.05} className="flex min-w-0 flex-col gap-1 px-[clamp(1rem,3vw,2.5rem)] py-7">
            <span className="font-display text-5xl leading-none text-ink tabular">{f.value}</span>
            <span className="text-sm text-ink">{f.label}</span>
            <span className="text-xs text-ink-subtle">{f.detail}</span>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
