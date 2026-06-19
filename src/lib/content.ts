import type { JSONContent } from "@tiptap/react";
import type { AuthorProfile } from "@/lib/editor/author-mark";
import { authorExportColor, authorSlot } from "@/lib/theme";

type AuthorMember = AuthorProfile & { isOwner?: boolean };

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

/** Texto antiguo sin marca se atribuye a la dueña del diario */
export function tagLegacyAuthorship(
  content: JSONContent,
  owner: AuthorProfile
): JSONContent {
  const tagged = JSON.parse(JSON.stringify(content)) as JSONContent;

  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) {
      const marks = node.marks ?? [];
      const hasAuthor = marks.some((m) => m.type === "author");
      if (!hasAuthor) {
        node.marks = [
          ...marks,
          {
            type: "author",
            attrs: {
              userId: owner.userId,
              authorSlot: "owner",
              color: owner.color || authorExportColor(true),
            },
          },
        ];
      }
    }
    node.content?.forEach(walk);
  }

  walk(tagged);
  return tagged;
}

/** Sincroniza marcas de autora con los colores y roles actuales del diario */
export function syncAuthorMarks(
  content: JSONContent,
  members: AuthorMember[]
): JSONContent {
  const byUserId = new Map(members.map((m) => [m.userId, m]));
  const owner = members.find((m) => m.isOwner);
  const synced = JSON.parse(JSON.stringify(content)) as JSONContent;

  function walk(node: JSONContent) {
    if (node.type === "text" && node.marks?.length) {
      node.marks = node.marks.map((mark) => {
        if (mark.type !== "author") return mark;

        const userId = mark.attrs?.userId as string | undefined;
        const member = userId ? byUserId.get(userId) : owner;
        if (!member) return mark;

        const slot = authorSlot(!!member.isOwner);
        return {
          type: "author",
          attrs: {
            userId: member.userId,
            authorSlot: slot,
            color: member.color || authorExportColor(!!member.isOwner),
          },
        };
      });
    }
    node.content?.forEach(walk);
  }

  walk(synced);
  return synced;
}
