import { BookOpen, FileSignature, FileText, Landmark, LineChart, Wrench } from "lucide-react";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** From backend/src/docqa/doctypes/strategies.py: passage size and the extra answering rule per type. */
const TYPES = [
  { icon: FileSignature, name: "Contract", size: 900, headings: "Article, Clause, Schedule, Recitals", rule: "Say which party each obligation binds; keep amounts, conditions and notice periods exactly as written." },
  { icon: BookOpen, name: "Research paper", size: 1100, headings: "Abstract, Methods, Results…", rule: "Separate findings from speculation; report numbers with units and their experiment. Stops indexing at References." },
  { icon: LineChart, name: "Financial report", size: 700, headings: "Numbered and capitalised headings", rule: "Quote figures with currency, unit and period. Don’t compute new figures unless asked, and show the arithmetic." },
  { icon: Landmark, name: "Regulation", size: 900, headings: "Chapter, Part, Annexure, Schedule", rule: "Quote “shall” and “must” precisely, give effective dates, and prefer the document that replaced a superseded one." },
  { icon: Wrench, name: "Manual", size: 800, headings: "Step 1, numbered steps", rule: "Give procedures as numbered steps in the document’s order, and keep warnings and cautions." },
  { icon: FileText, name: "Other", size: 900, headings: "Numbered and capitalised headings", rule: "The base rules only: excerpts, citations, refusal." },
];

export function DocTypes() {
  return (
    <Section
      id="types"
      index="06"
      eyebrow="Document types"
      title={
        <>
          A lease is not <em>a research paper.</em>
        </>
      }
      lede="Each upload is classified from phrases in its opening pages, and each type gets its own heading rules, passage size and answering instructions. Wrong guess? Change the type and the document is re-chunked from the original."
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
        {TYPES.map(({ icon: Icon, name, size, headings, rule }, i) => (
          <Reveal as="li" key={name} delay={(i % 3) * 0.05} className="flex min-w-0 flex-col gap-3 bg-surface p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <Icon aria-hidden className="size-5 text-verified-text" />
                <span className="text-lg font-medium text-ink">{name}</span>
              </span>
              <span className="font-mono text-xs text-ink-subtle tabular">~{size.toLocaleString("en")} chars</span>
            </div>
            <p className="m-0 text-sm leading-relaxed text-ink-muted">{rule}</p>
            <p className="m-0 mt-auto font-mono text-[11.5px] text-ink-subtle">Headings: {headings}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
