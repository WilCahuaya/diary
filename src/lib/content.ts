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

export function imageProxyPath(imageId: string): string {
  return `/api/images/${imageId}/file`;
}

/** Asegura URLs de imagen relativas y con ID para que funcionen en producción */
export function normalizeImageUrls(content: JSONContent): JSONContent {
  const normalized = JSON.parse(JSON.stringify(content)) as JSONContent;

  function walk(node: JSONContent) {
    if (node.type === "image" && node.attrs) {
      const src = node.attrs.src as string | undefined;
      const fromSrc = src?.match(/\/api\/images\/([a-f0-9-]+)\/file/i)?.[1];
      const imageId = (node.attrs.dataImageId ??
        node.attrs["data-image-id"] ??
        fromSrc) as string | undefined;

      if (imageId) {
        node.attrs.src = imageProxyPath(imageId);
        node.attrs.dataImageId = imageId;
      }
    }
    node.content?.forEach(walk);
  }

  walk(normalized);
  return normalized;
}
