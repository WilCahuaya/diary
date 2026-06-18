"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CalendarView } from "@/components/calendar/calendar-view";
import type { CalendarDay } from "@/types/database";

export default function CalendarPage() {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => setDays(data.days ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-lg px-3 py-4 sm:px-4 sm:py-6">
        <h1 className="mb-6 text-xl font-medium">Calendario</h1>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <CalendarView days={days} />
        )}
      </main>
    </>
  );
}
