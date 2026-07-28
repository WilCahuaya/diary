import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { ResizableImageView } from "@/components/editor/resizable-image";

function parseWidth(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export const DiaryImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute("width");
          if (attr) return parseWidth(attr);
          return parseWidth(element.style.width);
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px; height: auto;`,
          };
        },
      },
      dataImageId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-image-id"),
        renderHTML: (attributes) => {
          if (!attributes.dataImageId) return {};
          return { "data-image-id": attributes.dataImageId };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export function insertDiaryImage(
  editor: Editor,
  attrs: { src: string; alt?: string; dataImageId?: string; width?: number }
) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "image",
      attrs: { alt: "", ...attrs },
    })
    .run();
}
