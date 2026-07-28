"use client";

import { useCallback, useEffect, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export interface EntryReadInfo {
  userId: string;
  displayName: string;
  lastReadAt: string | null;
}

interface EntryReadStatusProps {
  entryDate: string;
}

function formatReadAt(iso: string): string {
  const date = parseISO(iso);
  const ageMs = Date.now() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (ageMs < oneDay) {
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  }

  return format(date, "d MMM 'a las' HH:mm", { locale: es });
}

export function EntryReadStatus({ entryDate }: EntryReadStatusProps) {
  const [reads, setReads] = useState<EntryReadInfo[]>([]);
  const [ready, setReady] = useState(false);

  const loadReads = useCallback(async () => {
    try {
      const res = await fetch(`/api/reads?date=${entryDate}`);
      if (!res.ok) return;
      const data = await res.json();
      setReads((data.reads as EntryReadInfo[]) ?? []);
      setReady(true);
    } catch {
      // silencioso
    }
  }, [entryDate]);

  useEffect(() => {
    let cancelled = false;

    async function markAndLoad() {
      try {
        await fetch("/api/reads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entry_date: entryDate }),
        });
      } catch {
        // silencioso
      }
      if (!cancelled) await loadReads();
    }

    setReady(false);
    setReads([]);
    markAndLoad();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadReads();
      }
    }, 30000);

    function onFocus() {
      loadReads();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [entryDate, loadReads]);

  if (!ready || reads.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      {reads.map((read) => (
        <p key={read.userId}>
          {read.lastReadAt ? (
            <>
              <span className="font-medium text-foreground">{read.displayName}</span>
              {" lo vio "}
              {formatReadAt(read.lastReadAt)}
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{read.displayName}</span>
              {" aún no ha visto esta entrada"}
            </>
          )}
        </p>
      ))}
    </div>
  );
}
