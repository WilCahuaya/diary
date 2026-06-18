import type { JSONContent } from "@tiptap/react";

export function extractPlainText(content: JSONContent): string {
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function extractImageIds(content: JSONContent): string[] {
  const ids: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "image" && node.attrs?.dataImageId) {
      ids.push(node.attrs.dataImageId as string);
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return ids;
}
