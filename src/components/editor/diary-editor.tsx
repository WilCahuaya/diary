"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { DiaryImage, insertDiaryImage } from "@/lib/editor/diary-image";
import { AuthorMark, AuthorTypingExtension, AuthorProtectionExtension, type AuthorProfile } from "@/lib/editor/author-mark";
import { AuthorLegend } from "./author-legend";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { ImagePlus } from "lucide-react";
import { extractPlainText } from "@/lib/content";
import {
  queuePendingSave,
  removePendingSave,
  cacheEntry,
  getCachedEntry,
} from "@/lib/offline/db";
import { cn } from "@/lib/utils";

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

interface DiaryEditorProps {
  entryDate: string;
  initialContent: JSONContent;
  readOnly: boolean;
  authorProfile: AuthorProfile;
  members: AuthorProfile[];
  guestCanWrite?: boolean;
  onSaved?: (updatedAt: string) => void;
}

export function DiaryEditor({
  entryDate,
  initialContent,
  readOnly,
  authorProfile,
  members,
  guestCanWrite = true,
  onSaved,
}: DiaryEditorProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = useRef(typeof navigator !== "undefined" ? navigator.onLine : true);

  const saveEntry = useCallback(
    async (content: JSONContent) => {
      if (readOnly) return;

      const contentPlain = extractPlainText(content);
      setSaveStatus("saving");

      if (!navigator.onLine) {
        await queuePendingSave(entryDate, content, contentPlain);
        await cacheEntry(entryDate, content, contentPlain, new Date().toISOString());
        setSaveStatus("offline");
        return;
      }

      try {
        const res = await fetch("/api/entries", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entry_date: entryDate, content, content_plain: contentPlain }),
        });

        if (!res.ok) throw new Error("Error al guardar");

        const data = await res.json();
        await removePendingSave(entryDate);
        await cacheEntry(entryDate, content, contentPlain, data.updated_at);
        setSaveStatus("saved");
        onSaved?.(data.updated_at);

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        await queuePendingSave(entryDate, content, contentPlain);
        await cacheEntry(entryDate, content, contentPlain, new Date().toISOString());
        setSaveStatus("offline");
      }
    },
    [entryDate, readOnly, onSaved]
  );

  const uploadImage = useCallback(
    async (file: File): Promise<{ url: string; id: string } | null> => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/images", { method: "POST", body: formData });
        if (!res.ok) return null;
        const data = await res.json();
        return { url: data.url as string, id: data.id as string };
      } catch {
        return null;
      }
    },
    []
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        AuthorMark,
        ...(readOnly
          ? []
          : [
              AuthorTypingExtension.configure({ profile: authorProfile }),
              AuthorProtectionExtension.configure({ userId: authorProfile.userId }),
            ]),
        DiaryImage.configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: { class: "diary-inline-image" },
        }),
        Placeholder.configure({
          placeholder: readOnly
            ? "Esta entrada es de solo lectura."
            : "Escribe sobre tu día...",
        }),
      ],
    content: initialContent?.content?.length ? initialContent : EMPTY_DOC,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[50dvh] focus:outline-none px-0 py-2 text-base sm:min-h-[60vh] sm:px-1 sm:text-sm",
      },
      handleDrop(view, event) {
        if (readOnly) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (!imageFiles.length) return false;

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });

        imageFiles.forEach(async (file) => {
          const result = await uploadImage(file);
          if (result && coords) {
            view.dispatch(
              view.state.tr.insert(
                coords.pos,
                view.state.schema.nodes.image.create({
                  src: result.url,
                  alt: "",
                  dataImageId: result.id,
                })
              )
            );
          }
        });
        return true;
      },
      handlePaste(view, event) {
        if (readOnly) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            uploadImage(file).then((result) => {
              if (result) {
                const { tr } = view.state;
                view.dispatch(
                  tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({
                      src: result.url,
                      alt: "",
                      dataImageId: result.id,
                    })
                  )
                );
              }
            });
            return true;
          }
        }
        return false;
      },
    },
    onBlur: ({ editor: ed }) => {
      if (!readOnly) saveEntry(ed.getJSON());
    },
  },
    [authorProfile.userId, authorProfile.color, entryDate, readOnly]
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const content = initialContent?.content?.length ? initialContent : EMPTY_DOC;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, entryDate, initialContent]);

  useEffect(() => {
    async function syncOffline() {
      if (!navigator.onLine || readOnly) return;
      const { getPendingSaves } = await import("@/lib/offline/db");
      const pending = await getPendingSaves();
      if (!pending.length) return;

      const res = await fetch("/api/entries/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pending: pending.map((p) => ({
            entryDate: p.entryDate,
            content: p.content,
            contentPlain: p.contentPlain,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          for (const p of pending) {
            await removePendingSave(p.entryDate);
          }
          setSaveStatus("saved");
        }
      }
    }

    function handleOnline() {
      isOnline.current = true;
      syncOffline();
    }

    function handleOffline() {
      isOnline.current = false;
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    getCachedEntry(entryDate).then((cached) => {
      if (cached && editor && !readOnly) {
        const serverTime = initialContent ? new Date().toISOString() : "";
        if (cached.updatedAt > serverTime) {
          editor.commands.setContent(cached.content, { emitUpdate: false });
        }
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [editor, entryDate, readOnly, initialContent]);

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !editor) return;

    for (const file of Array.from(files)) {
      const result = await uploadImage(file);
      if (result) {
        insertDiaryImage(editor, { src: result.url, dataImageId: result.id });
      }
    }
    e.target.value = "";
  }

  return (
    <div className="relative">
      <AuthorLegend
        members={members}
        currentUserId={authorProfile.userId}
        guestCanWrite={guestCanWrite}
      />
      {!readOnly && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3 sm:mb-4 lg:justify-end">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors active:bg-accent hover:bg-accent hover:text-accent-foreground lg:hidden">
            <ImagePlus className="h-5 w-5 shrink-0" />
            Elegir imagen
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
          <span
            className={cn(
              "text-xs transition-opacity lg:ml-auto",
              saveStatus === "idle" ? "opacity-0" : "opacity-100",
              saveStatus === "offline" && "text-muted-foreground",
              saveStatus === "saved" && "text-primary"
            )}
          >
            {saveStatus === "saving" && "Guardando..."}
            {saveStatus === "saved" && "Guardado"}
            {saveStatus === "offline" && "Sin conexión — guardado localmente"}
          </span>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
