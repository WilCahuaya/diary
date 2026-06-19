import type { JSONContent } from "@tiptap/react";
import { authorExportColor } from "@/lib/theme";

function renderNode(node: JSONContent): string {
  switch (node.type) {
    case "doc":
      return node.content?.map(renderNode).join("") ?? "";
    case "paragraph":
      return `<p>${node.content?.map(renderNode).join("") ?? ""}</p>`;
    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      return `<h${level}>${node.content?.map(renderNode).join("") ?? ""}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${node.content?.map(renderNode).join("") ?? ""}</ul>`;
    case "orderedList":
      return `<ol>${node.content?.map(renderNode).join("") ?? ""}</ol>`;
    case "listItem":
      return `<li>${node.content?.map(renderNode).join("") ?? ""}</li>`;
    case "blockquote":
      return `<blockquote>${node.content?.map(renderNode).join("") ?? ""}</blockquote>`;
    case "hardBreak":
      return "<br />";
    case "text": {
      let text = escapeHtml(node.text ?? "");
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "bold") text = `<strong>${text}</strong>`;
          if (mark.type === "italic") text = `<em>${text}</em>`;
          if (mark.type === "underline") text = `<u>${text}</u>`;
          if (mark.type === "strike") text = `<s>${text}</s>`;
          if (mark.type === "author") {
            const slot = mark.attrs?.authorSlot as string | undefined;
            const color =
              (mark.attrs?.color as string) ??
              authorExportColor(slot === "owner");
            text = `<span style="color:${escapeHtml(color)}">${text}</span>`;
          }
        }
      }
      return text;
    }
    case "image": {
      const src = node.attrs?.src as string;
      const alt = escapeHtml((node.attrs?.alt as string) ?? "");
      return `<figure class="diary-image"><img src="${src}" alt="${alt}" /></figure>`;
    }
    default:
      return node.content?.map(renderNode).join("") ?? "";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function tiptapToHtml(content: JSONContent, title?: string): string {
  const body = renderNode(content);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 1.4rem; font-weight: normal; margin-bottom: 2rem; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
    p { margin: 0 0 1em; }
    .diary-image { margin: 1.5em 0; }
    .diary-image img { max-width: 100%; height: auto; }
    ul, ol { margin: 0 0 1em 1.5em; }
    blockquote { border-left: 3px solid #ccc; margin: 1em 0; padding-left: 1em; color: #555; }
  </style>
</head>
<body>
  ${title ? `<h1>${escapeHtml(title)}</h1>` : ""}
  ${body}
</body>
</html>`;
}
