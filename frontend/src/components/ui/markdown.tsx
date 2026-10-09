"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const SAFE_URL = /^https?:\/\//i;

export const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) =>
    href && SAFE_URL.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-verified-text underline underline-offset-2">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  table: ({ children }) => (
    <div data-wide className="my-3 max-w-full overflow-x-auto rounded-md border border-line" role="region" aria-label="Table" tabIndex={0}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line bg-surface-2 px-3 py-2 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-3 py-2 align-top">{children}</td>,
  img: () => null,
};

/** Markdown without raw HTML; only http(s) links, opened safely. */
export function Markdown({ children, className, components }: { children: string; className?: string; components?: Components }) {
  return (
    <div className={cn("prose-doc", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ ...MARKDOWN_COMPONENTS, ...components }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
