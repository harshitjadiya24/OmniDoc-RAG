import { Columns2, FileStack, FileText } from "lucide-react";
import { EventLog } from "./event-log";
import { Fusion } from "./fusion";
import { Reveal } from "./reveal";
import { Section } from "./section";

const ROUTES = [
  { icon: FileText, mode: "Single", rule: "One pooled search across the selected documents.", when: "Default" },
  { icon: FileStack, mode: "Multi", rule: "Each document searched on its own and interleaved, so a long one can’t crowd out the rest.", when: "“each”, “across”, “all documents”" },
  { icon: Columns2, mode: "Compare", rule: "Two documents, A earlier and B later, answered in four fixed sections.", when: "“compare”, “differ”, “what changed”" },
];

export function AskPipeline() {
  return (
    <Section
      id="asking"
      index="03"
      eyebrow="Asking"
      title={
        <>
          Every step of the answer <em>is on the wire.</em>
        </>
      }
      lede="A question is planned, retrieved, ranked and drafted, and the server streams each stage as it happens. The interface shows exactly what arrives, never a number it didn’t receive."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal className="min-w-0">
          <EventLog />
        </Reveal>
        <Reveal delay={0.08} className="min-w-0">
          <Fusion />
        </Reveal>
      </div>
      <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
        {ROUTES.map(({ icon: Icon, mode, rule, when }, i) => (
          <Reveal as="li" key={mode} delay={i * 0.06} className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-5">
            <span className="flex items-center gap-2 text-ink">
              <Icon aria-hidden className="size-4 text-verified-text" />
              <span className="font-medium">{mode}</span>
            </span>
            <p className="m-0 text-sm leading-relaxed text-ink-muted">{rule}</p>
            <p className="m-0 mt-auto font-mono text-[11.5px] text-ink-subtle">Triggered by: {when}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
