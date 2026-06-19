"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { CalendarDay } from "@/types/database";
import { cn } from "@/lib/utils";
import { toDateString } from "@/lib/dates";

interface CalendarViewProps {
  days: CalendarDay[];
  initialYear?: number;
  initialMonth?: number;
}

export function CalendarView({ days, initialYear, initialMonth }: CalendarViewProps) {
  const now = new Date();
  const [viewDate, setViewDate] = useState(
    new Date(initialYear ?? now.getFullYear(), (initialMonth ?? now.getMonth() + 1) - 1, 1)
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    days.forEach((d) => map.set(d.entry_date, d));
    return map;
  }, [days]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = (getDay(monthStart) + 6) % 7;

  function goToYear(year: number) {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
  }

  const currentYear = viewDate.getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[140px] text-center text-lg font-medium capitalize">
            {format(viewDate, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            type="button"
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <select
          value={currentYear}
          onChange={(e) => goToYear(Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {calendarDays.map((day) => {
          const dateStr = toDateString(day);
          const info = dayMap.get(dateStr);
          const hasContent = info?.has_content ?? false;
          const isFavorite = info?.is_favorite ?? false;
          const inMonth = isSameMonth(day, viewDate);

          if (!hasContent && !isFavorite) {
            return (
              <div
                key={dateStr}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-sm text-muted-foreground/40",
                  !inMonth && "opacity-30"
                )}
              >
                {format(day, "d")}
              </div>
            );
          }

          return (
            <Link
              key={dateStr}
              href={`/diary/${dateStr}`}
              title={isFavorite ? info?.favorite_reason ?? "Favorito" : undefined}
              className={cn(
                "relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg text-xs transition-colors active:bg-accent hover:bg-accent sm:min-h-0 sm:text-sm",
                isFavorite && "ring-favorite bg-favorite-soft ring-2",
                hasContent && !isFavorite && "bg-accent/50 font-medium"
              )}
            >
              {format(day, "d")}
              {isFavorite && (
                <span className="absolute bottom-1 text-[10px] text-favorite">
                  ★
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-accent/50" />
          Con contenido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded ring-favorite bg-favorite-soft ring-2" />
          Favorito
        </span>
      </div>
    </div>
  );
}
