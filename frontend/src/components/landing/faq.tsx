import { Plus } from "lucide-react";
import { Section } from "./section";

const FAQ = [
  {
    q: "Does “supported” mean the answer is correct?",
    a: "No. It means most of the statement’s key words appear on the cited page. That catches wrong pages and invented statements, but word overlap cannot judge paraphrase, negation or reasoning. Read the passage when it matters; it’s one click away.",
  },
  {
    q: "What happens when the documents don’t answer my question?",
    a: "If retrieval finds nothing, no model is called and you get a refusal. If the model finds the excerpts insufficient, it replies with a fixed sentence that the app detects and shows as a refusal, with suggestions to try instead.",
  },
  { q: "Can it read scanned PDFs?", a: "Yes, pages with no text layer are OCRed with Tesseract, up to a per-upload limit set on the server. Password-protected PDFs are rejected with a clear message." },
  {
    q: "What are “Citations resolved N of M”?",
    a: "A number the browser derives: how many of the answer’s citations name a document and page that were among the passages actually retrieved. A citation that matches nothing is marked “Unverified citation”.",
  },
  { q: "How do versions work?", a: "Edit a document and list what it supersedes, by document ID or reference number. The older document is labelled superseded in the library, the evidence and the prompt, and answers prefer the newer one." },
  { q: "Which answer models are supported?", a: "A local Ollama model by default, or Google Gemini when the server has an API key. Every model has a hard output cap, and a failure mid-answer ends the stream with the provider’s reason." },
];

export function Faq() {
  return (
    <Section id="faq" index="08" eyebrow="Questions" title={<>Honest answers, <em>with their limits.</em></>}>
      <div className="mx-auto max-w-[880px] divide-y divide-line border-y border-line">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <Plus aria-hidden className="size-5 shrink-0 text-ink-subtle transition-transform duration-300 group-open:rotate-45" />
            </summary>
            <p className="m-0 max-w-[68ch] pb-6 text-[15px] leading-relaxed text-ink-muted">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
