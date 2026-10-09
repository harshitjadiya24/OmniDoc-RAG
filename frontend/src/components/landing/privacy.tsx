import { Cloud, HardDrive } from "lucide-react";
import { Reveal } from "./reveal";
import { Section } from "./section";

const LOCAL = [
  ["Embeddings", "bge-small-en-v1.5 via FastEmbed (ONNX, CPU)"],
  ["Rerank", "ms-marco-MiniLM-L-6-v2 cross-encoder"],
  ["Answers", "Ollama, qwen3:1.7b by default"],
  ["Storage", "SQLite, Chroma and the original PDFs on your disk"],
];

export function Privacy() {
  return (
    <Section
      id="privacy"
      index="07"
      eyebrow="Privacy"
      title={
        <>
          Local by default. <em>Cloud only if you choose.</em>
        </>
      }
      lede="Out of the box every model runs on your machine, so your documents never leave it. Add a Gemini key and you can pick it per question; the model picker says which one sends passages away."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <Reveal className="flex min-w-0 flex-col gap-4 rounded-2xl border border-verified/35 bg-surface p-6">
          <span className="flex items-center gap-2 text-ink">
            <HardDrive aria-hidden className="size-5 text-verified-text" />
            <span className="font-medium">The default stack</span>
          </span>
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {LOCAL.map(([k, v]) => (
              <div key={k} className="min-w-0 border-t border-line pt-3">
                <dt className="text-xs tracking-wide text-ink-subtle uppercase">{k}</dt>
                <dd className="m-0 mt-1 text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal delay={0.06} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-6">
          <span className="flex items-center gap-2 text-ink">
            <Cloud aria-hidden className="size-5 text-ink-muted" />
            <span className="font-medium">Optional: Gemini</span>
          </span>
          <p className="m-0 text-sm leading-relaxed text-ink-muted">
            Enabled only when the server has <code className="font-mono text-ink">GEMINI_API_KEY</code>. With accounts on, every user gets a private library, signed sessions and
            per-user rate limits.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
