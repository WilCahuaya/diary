import Image from "@tiptap/extension-image";
import type { Editor } from "@tiptap/react";

export const DiaryImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
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
});

export function insertDiaryImage(
  editor: Editor,
  attrs: { src: string; alt?: string; dataImageId?: string }
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
