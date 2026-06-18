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
import type { Entry, Favorite } from "@/types/database";

interface DiaryPageClientProps {
  dateParam: string;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

export function DiaryPageClient({ dateParam }: DiaryPageClientProps) {
  const router = useRouter();
  const entryDate = resolveDateParam(dateParam);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [favorite, setFavorite] = useState<Favorite | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);

  useEffect(() => {
    if (!entryDate) {
      router.replace("/diary/today");
      return;
    }

    setLoading(true);

    Promise.all([
      fetch(`/api/entries?date=${entryDate}`).then((r) => r.json()),
      fetch(`/api/favorites?date=${entryDate}`).then((r) => r.json()),
    ]).then(([entryData, favData]) => {
      setEntry(entryData.entry ?? null);
      setFavorite(favData.favorite ?? null);
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
  const readOnly = entryDate ? isReadOnlyDate(entryDate) : true;

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
        onToggleFavorite={() => setFavoriteDialogOpen(true)}
      />

      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <>
            {readOnly && (
              <p className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Esta entrada es de solo lectura. Solo puedes editar hoy y ayer.
              </p>
            )}
            {favorite?.reason && (
              <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
                ★ Favorito: {favorite.reason}
              </p>
            )}
            <DiaryEditor
              key={entryDate}
              entryDate={entryDate}
              initialContent={entry?.content ?? EMPTY_DOC}
              readOnly={readOnly}
            />
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
