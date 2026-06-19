"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO, subDays } from "date-fns";
import type { JSONContent } from "@tiptap/react";
import { AppHeader } from "@/components/app-header";
import { DiaryEditor } from "@/components/editor/diary-editor";
import { FavoriteDialog } from "@/components/favorite-dialog";
import {
  resolveDateParam,
  isReadOnlyDate,
  todayString,
} from "@/lib/dates";
import type { Entry, Favorite, MembersResponse } from "@/types/database";
import type { AuthorProfile } from "@/lib/editor/author-mark";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();

  if (!text) {
    throw new Error(res.ok ? "Respuesta vacía del servidor" : `Error ${res.status}`);
  }

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta inválida del servidor (${res.status})`);
  }

  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error ?? `Error ${res.status}`);
  }

  return data;
}

interface DiaryPageClientProps {
  dateParam: string;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

export function DiaryPageClient({ dateParam }: DiaryPageClientProps) {
  const router = useRouter();
  const entryDate = resolveDateParam(dateParam);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [favorite, setFavorite] = useState<Favorite | null>(null);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [members, setMembers] = useState<AuthorProfile[]>([]);
  const [canWrite, setCanWrite] = useState(true);
  const [guestCanWrite, setGuestCanWrite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);

  useEffect(() => {
    if (!entryDate) {
      router.replace("/diary/today");
      return;
    }

    setLoading(true);

    Promise.all([
      fetchJson<{ entry: Entry | null }>(`/api/entries?date=${entryDate}`),
      fetchJson<{ favorite: Favorite | null }>(`/api/favorites?date=${entryDate}`),
      fetchJson<MembersResponse>("/api/members"),
    ]).then(([entryData, favData, membersData]) => {
      setEntry(entryData.entry ?? null);
      setFavorite(favData.favorite ?? null);
      const mapped = membersData.members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        color: m.color,
        isOwner: m.isOwner,
      }));
      setMembers(mapped);
      setCanWrite(membersData.current.canWrite);
      setGuestCanWrite(membersData.guestCanWrite);
      setAuthorProfile({
        userId: membersData.current.userId,
        displayName: membersData.current.displayName,
        color: membersData.current.color,
        isOwner: membersData.current.isOwner,
      });
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [entryDate, router]);

  const goToPrevDay = useCallback(() => {
    if (!entryDate) return;
    const prev = format(subDays(parseISO(entryDate), 1), "yyyy-MM-dd");
    router.push(`/diary/${prev}`);
  }, [entryDate, router]);

  const goToNextDay = useCallback(() => {
    if (!entryDate) return;
    const next = format(addDays(parseISO(entryDate), 1), "yyyy-MM-dd");
    if (next <= todayString()) {
      router.push(`/diary/${next}`);
    }
  }, [entryDate, router]);

  const canGoNext = entryDate ? entryDate < todayString() : false;
  const dateReadOnly = entryDate ? isReadOnlyDate(entryDate) : true;
  const readOnly = dateReadOnly || !canWrite;

  async function handleFavoriteSave(reason: string | null) {
    if (!entryDate) return;

    const res = await fetch("/api/favorites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_date: entryDate, reason }),
    });

    if (res.ok) {
      const data = await res.json();
      setFavorite(data.favorite);
      setFavoriteDialogOpen(false);
    }
  }

  async function handleFavoriteRemove() {
    if (!entryDate) return;

    await fetch(`/api/favorites?date=${entryDate}`, { method: "DELETE" });
    setFavorite(null);
    setFavoriteDialogOpen(false);
  }

  if (!entryDate) return null;

  return (
    <>
      <AppHeader
        entryDate={entryDate}
        onPrevDay={goToPrevDay}
        onNextDay={goToNextDay}
        canGoNext={canGoNext}
        isFavorite={!!favorite}
        onToggleFavorite={canWrite ? () => setFavoriteDialogOpen(true) : undefined}
      />

      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <>
            {!canWrite && (
              <p className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tienes acceso de solo lectura. El dueño del diario desactivó la edición
                para tu cuenta.
              </p>
            )}
            {canWrite && dateReadOnly && (
              <p className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Esta entrada es de solo lectura. Solo puedes editar hoy y ayer.
              </p>
            )}
            {favorite?.reason && (
              <p className="mb-4 text-sm text-favorite">
                ★ Favorito: {favorite.reason}
              </p>
            )}
            {authorProfile && (
              <DiaryEditor
                key={entryDate}
                entryDate={entryDate}
                initialContent={entry?.content ?? EMPTY_DOC}
                readOnly={readOnly}
                authorProfile={authorProfile}
                members={members}
                guestCanWrite={guestCanWrite}
              />
            )}
          </>
        )}
      </main>

      {favoriteDialogOpen && (
        <FavoriteDialog
          isFavorite={!!favorite}
          currentReason={favorite?.reason ?? null}
          onSave={handleFavoriteSave}
          onRemove={handleFavoriteRemove}
          onClose={() => setFavoriteDialogOpen(false)}
        />
      )}
    </>
  );
}
