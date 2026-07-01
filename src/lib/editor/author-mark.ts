import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import type { Node as PMNode, MarkType } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
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
  if (!authorMark?.attrs.userId) return false;
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

function canInsertAt(
  state: EditorState,
  pos: number,
  currentUserId: string,
  markType: MarkType
): boolean {
  const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size));

  if ($pos.parent.type.name === "paragraph" && $pos.parent.content.size === 0) {
    return true;
  }

  const authorAtCursor = $pos.marks().find((m) => m.type === markType);
  if (
    authorAtCursor?.attrs.userId &&
    authorAtCursor.attrs.userId !== currentUserId
  ) {
    return false;
  }

  return true;
}

function paragraphIsForeignOnly(
  node: PMNode,
  markType: MarkType,
  currentUserId: string
): boolean {
  if (node.type.name !== "paragraph" || node.content.size === 0) {
    return false;
  }

  let hasOwnText = false;
  let hasForeignText = false;

  node.forEach((child) => {
    if (!child.isText) return;
    if (isForeignText(child, markType, currentUserId)) {
      hasForeignText = true;
    } else {
      hasOwnText = true;
    }
  });

  return hasForeignText && !hasOwnText;
}

function isForeignClick(
  state: EditorState,
  pos: number,
  currentUserId: string,
  markType: MarkType
): boolean {
  const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size));

  if ($pos.parent.type.name === "paragraph") {
    if (paragraphIsForeignOnly($pos.parent, markType, currentUserId)) {
      return true;
    }
  }

  return !canInsertAt(state, pos, currentUserId, markType);
}

function findOrCreateWritablePos(
  view: EditorView,
  currentUserId: string,
  markType: MarkType
): number {
  const { state } = view;
  const { doc, schema } = state;

  let lastEmptyPos: number | null = null;
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.content.size === 0) {
      lastEmptyPos = pos + 1;
    }
  });

  if (lastEmptyPos !== null) {
    return lastEmptyPos;
  }

  const lastBlock = doc.lastChild;
  if (lastBlock && paragraphIsForeignOnly(lastBlock, markType, currentUserId)) {
    const insertPos = doc.content.size;
    const tr = state.tr.insert(insertPos, schema.nodes.paragraph.create());
    view.dispatch(tr);
    return insertPos + 1;
  }

  return Math.max(1, doc.content.size - 1);
}

function redirectToWritablePos(
  view: EditorView,
  currentUserId: string,
  markType: MarkType
): boolean {
  const targetPos = findOrCreateWritablePos(view, currentUserId, markType);
  const selection = TextSelection.create(view.state.doc, targetPos);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}

function createAuthorCursorPlugin(currentUserId: string) {
  return new Plugin({
    key: new PluginKey("authorCursor"),
    props: {
      decorations(state) {
        const markType = state.schema.marks.author;
        if (!markType) return DecorationSet.empty;

        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (
            node.type.name === "paragraph" &&
            paragraphIsForeignOnly(node, markType, currentUserId)
          ) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "diary-paragraph--foreign",
              })
            );
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
      handleClick(view, pos) {
        const markType = view.state.schema.marks.author;
        if (!markType) return false;

        if (isForeignClick(view.state, pos, currentUserId, markType)) {
          return redirectToWritablePos(view, currentUserId, markType);
        }

        return false;
      },
      handleDOMEvents: {
        mousedown(view, event) {
          const markType = view.state.schema.marks.author;
          if (!markType) return false;

          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!coords) return false;

          if (isForeignClick(view.state, coords.pos, currentUserId, markType)) {
            event.preventDefault();
            return redirectToWritablePos(view, currentUserId, markType);
          }

          return false;
        },
      },
    },
  });
}

function getForeignTextSnapshot(
  doc: EditorState["doc"],
  markType: MarkType,
  currentUserId: string
): string {
  const parts: string[] = [];
  doc.descendants((node) => {
    if (node.isText && isForeignText(node, markType, currentUserId)) {
      parts.push(node.text ?? "");
    }
  });
  return parts.join("\0");
}

function blocksParagraphJoinIntoForeign(
  state: EditorState,
  from: number,
  to: number,
  markType: MarkType,
  currentUserId: string
): boolean {
  if (to <= from) return false;

  const $from = state.doc.resolve(from);
  if ($from.parent.type.name !== "paragraph") return false;

  const paraStart = $from.start();
  if (from > paraStart) return false;

  const index = $from.index($from.depth - 1);
  if (index === 0) return false;

  const prevSibling = $from.node($from.depth - 1).child(index - 1);
  return paragraphIsForeignOnly(prevSibling, markType, currentUserId);
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

          if (blocksParagraphJoinIntoForeign(state, from, to, markType, currentUserId)) {
            return false;
          }
        }

        if (
          step.slice.content.size > 0 &&
          !canInsertAt(state, from, currentUserId, markType)
        ) {
          return false;
        }
      }

      let newState: EditorState;
      try {
        newState = state.apply(transaction);
      } catch {
        return false;
      }

      const { head, empty } = newState.selection;

      if (isForeignClick(newState, head, currentUserId, markType)) {
        return false;
      }

      if (!empty) {
        let selectionTouchesForeign = false;
        newState.doc.nodesBetween(newState.selection.from, newState.selection.to, (node) => {
          if (isForeignText(node, markType, currentUserId)) {
            selectionTouchesForeign = true;
          }
        });
        if (selectionTouchesForeign) return false;
      }

      if (
        getForeignTextSnapshot(state.doc, markType, currentUserId) !==
        getForeignTextSnapshot(newState.doc, markType, currentUserId)
      ) {
        return false;
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
    return [
      createAuthorProtectionPlugin(this.options.userId),
      createAuthorCursorPlugin(this.options.userId),
    ];
  },
});
