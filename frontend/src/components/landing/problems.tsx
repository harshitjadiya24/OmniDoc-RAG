import { EyeOff, FileClock, Search, ShieldAlert } from "lucide-react";
import { Reveal } from "./reveal";
import { Section } from "./section";

const PROBLEMS = [
  {
    icon: ShieldAlert,
    title: "Fluent answers you can’t check",
    problem: "Ask a chatbot for a contract’s notice period and you get a confident sentence with nothing behind it.",
    fix: "The model may only use retrieved excerpts and must cite document and page. Then each cited page is re-read and the claim scored against it.",
  },
  {
    icon: EyeOff,
    title: "Systems that never say “I don’t know”",
    problem: "Most RAG demos answer something no matter what was retrieved.",
    fix: "No passages means no model call and a refusal. If the model itself finds no evidence, the refusal is detected and shown calmly, not dressed up as an answer.",
  },
  {
    icon: Search,
    title: "One clause in three hundred pages",
    problem: "Keyword search needs the exact words. Semantic search misses “Clause 4.2.1” and “₹50,000”.",
    fix: "BM25 and dense vectors run together and are fused with reciprocal rank fusion; a cross-encoder can re-score the top of the list.",
  },
  {
    icon: FileClock,
    title: "Old versions quoted as current",
    problem: "A 2016 direction replaced in 2025 still matches your question perfectly.",
    fix: "Documents declare what they supersede. Superseded excerpts are labelled in the prompt and in the UI, and the model is told to prefer the replacement.",
  },
];

export function Problems() {
  return (
    <Section
      id="problem"
      index="01"
      eyebrow="The problem"
      title={
        <>
          Plausible is not <em>the same as true.</em>
        </>
      }
      lede="Retrieval-augmented generation is supposed to ground a model in your documents. In practice four things go wrong, and each one is designed out here."
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
        {PROBLEMS.map(({ icon: Icon, title, problem, fix }, i) => (
          <Reveal as="li" key={title} delay={i * 0.06} className="group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-line bg-surface p-6">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-verified transition-transform duration-700 group-hover:scale-x-100" />
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-10 place-items-center rounded-lg border border-line bg-surface-2">
                <Icon className="size-5 text-ink-muted" />
              </span>
              <h3 className="m-0 text-lg font-medium text-ink">{title}</h3>
            </div>
            <p className="m-0 text-[15px] leading-relaxed text-ink-muted">{problem}</p>
            <p className="m-0 flex gap-2.5 border-t border-line pt-4 text-[15px] leading-relaxed text-ink">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-verified" />
              <span>{fix}</span>
            </p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
