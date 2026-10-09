import type { Parent, Root, Text } from "mdast";
import { visit } from "unist-util-visit";
import { segment } from "@/lib/rag/citations";

/**
 * Remark plugin: replaces citation brackets in text nodes with <cite-chip>
 * elements. Groups are numbered in reading order starting at `offset`, so
 * numbering stays global when an answer is rendered block by block.
 */
export function remarkCitations({ offset }: { offset: number }) {
  return (tree: Root) => {
    let group = offset;
    visit(tree, "text", (node: Text, index, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      const parts = segment(node.value);
      if (!parts.some((p) => p.kind === "cite")) return;
      const replacement = parts.map((p) =>
        p.kind === "text"
          ? ({ type: "text", value: p.text } as Text)
          : {
              type: "citeChip",
              data: {
                hName: "cite-chip",
                hProperties: { group: String(group++), refs: JSON.stringify(p.refs.map((r) => [r.docId, r.page])) },
              },
            },
      );
      parent.children.splice(index, 1, ...(replacement as Parent["children"]));
      return index + replacement.length;
    });
  };
}

/** Number of citation groups in a block, to offset the next block's numbering. */
export function countGroups(text: string): number {
  return segment(text).filter((p) => p.kind === "cite").length;
}
