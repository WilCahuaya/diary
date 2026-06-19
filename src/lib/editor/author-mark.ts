import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import type { Node as PMNode, MarkType } from "@tiptap/pm/model";
import { authorExportColor, authorSlot } from "@/lib/theme";

export interface AuthorProfile {
  userId: string;
  displayName: string;
  color: string;
  isOwner?: boolean;
}

export const AuthorMark = Mark.create({
  name: "author",

  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-author-id"),
        renderHTML: (attrs) =>
          attrs.userId ? { "data-author-id": attrs.userId } : {},
      },
      authorSlot: {
        default: "guest",
        parseHTML: (el) => el.getAttribute("data-author-slot") ?? "guest",
        renderHTML: (attrs) =>
          attrs.authorSlot ? { "data-author-slot": attrs.authorSlot } : {},
      },
      color: {
        default: "#4D7563",
        parseHTML: (el) =>
          el.getAttribute("data-author-color") ?? (el as HTMLElement).style?.color,
        renderHTML: (attrs) =>
          attrs.color ? { "data-author-color": attrs.color } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-author-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const slot = HTMLAttributes.authorSlot ?? HTMLAttributes["data-author-slot"] ?? "guest";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "diary-author-text",
        "data-author-slot": slot,
      }),
      0,
    ];
  },
});

function isForeignText(
  node: PMNode,
  markType: MarkType,
  currentUserId: string
): boolean {
  if (!node.isText) return false;
  const authorMark = node.marks.find((m) => m.type === markType);
  if (!authorMark?.attrs.userId) return true;
  return authorMark.attrs.userId !== currentUserId;
}

export function createAuthorPlugin(profile: AuthorProfile) {
  return new Plugin({
    key: new PluginKey("authorMark"),
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;

      const markType = newState.schema.marks.author;
      if (!markType) return null;

      const authorMark = markType.create({
        userId: profile.userId,
        authorSlot: authorSlot(!!profile.isOwner),
        color: profile.color || authorExportColor(!!profile.isOwner),
      });

      let tr = newState.tr;
      let modified = false;

      newState.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;

        const hasAuthor = node.marks.some((m) => m.type === markType);
        if (hasAuthor) return;

        const oldNode = oldState.doc.nodeAt(pos);
        const oldText = oldNode?.isText ? oldNode.text : "";
        if (oldText === node.text) return;

        tr = tr.addMark(pos, pos + node.nodeSize, authorMark);
        modified = true;
      });

      return modified ? tr : null;
    },
  });
}

export function createAuthorProtectionPlugin(currentUserId: string) {
  return new Plugin({
    key: new PluginKey("authorProtection"),
    filterTransaction(transaction, state) {
      if (!transaction.docChanged) return true;

      const markType = state.schema.marks.author;
      if (!markType) return true;

      for (const step of transaction.steps) {
        if (!(step instanceof ReplaceStep)) continue;

        const { from, to } = step;

        if (to > from) {
          let blocked = false;
          state.doc.nodesBetween(from, to, (node) => {
            if (isForeignText(node, markType, currentUserId)) {
              blocked = true;
            }
          });
          if (blocked) return false;
        }

        if (step.slice.content.size > 0) {
          const $pos = state.doc.resolve(Math.min(from, state.doc.content.size));
          const marksAtPos = $pos.marks();
          const authorAtCursor = marksAtPos.find((m) => m.type === markType);
          if (
            authorAtCursor?.attrs.userId &&
            authorAtCursor.attrs.userId !== currentUserId
          ) {
            return false;
          }

          const nodeBefore = from > 0 ? state.doc.nodeAt(from - 1) : null;
          if (nodeBefore && isForeignText(nodeBefore, markType, currentUserId)) {
            return false;
          }
        }
      }

      return true;
    },
  });
}

export const AuthorTypingExtension = Extension.create<{ profile: AuthorProfile }>({
  name: "authorTyping",

  addOptions() {
    return {
      profile: {
        userId: "",
        displayName: "",
        color: "#4D7563",
        isOwner: false,
      },
    };
  },

  addProseMirrorPlugins() {
    return [createAuthorPlugin(this.options.profile)];
  },
});

export const AuthorProtectionExtension = Extension.create<{ userId: string }>({
  name: "authorProtection",

  addOptions() {
    return { userId: "" };
  },

  addProseMirrorPlugins() {
    if (!this.options.userId) return [];
    return [createAuthorProtectionPlugin(this.options.userId)];
  },
});
