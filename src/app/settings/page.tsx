"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { exportEntriesToPdf } from "@/lib/export/pdf";
import type { Entry } from "@/types/database";
import { todayString } from "@/lib/dates";
import { format } from "date-fns";

export default function SettingsPage() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<"day" | "month" | "year">("day");
  const [exportValue, setExportValue] = useState(todayString());

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        alert("Error al generar el respaldo.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diario-respaldo-${todayString()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const res = await fetch(
        `/api/export?type=${exportType}&value=${encodeURIComponent(exportValue)}`
      );
      if (!res.ok) {
        alert("Error al exportar.");
        return;
      }
      const data = await res.json();
      const entries: Entry[] = data.entries ?? [];

      if (!entries.length) {
        alert("No hay entradas para exportar en ese periodo.");
        return;
      }

      const filename = `diario-${exportType}-${exportValue}.pdf`;
      await exportEntriesToPdf(entries, filename);
    } finally {
      setExportLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = format(new Date(), "yyyy-MM");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-lg px-3 py-4 sm:px-4 sm:py-6">
        <h1 className="mb-8 text-xl font-medium">Ajustes</h1>

        <section className="mb-10">
          <h2 className="mb-1 text-sm font-medium">Respaldo completo</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Descarga un archivo ZIP con la base de datos, imágenes originales y
            miniaturas. Suficiente para restaurar el diario en otro servidor.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backupLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {backupLoading ? "Generando..." : "Descargar respaldo ZIP"}
          </button>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-medium">Exportar a PDF</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Exporta entradas con imágenes incluidas.
          </p>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <div className="flex gap-2">
              {(["day", "month", "year"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setExportType(t);
                    if (t === "day") setExportValue(todayString());
                    else if (t === "month") setExportValue(currentMonth);
                    else setExportValue(String(currentYear));
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    exportType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground hover:opacity-80"
                  }`}
                >
                  {t === "day" ? "Día" : t === "month" ? "Mes" : "Año"}
                </button>
              ))}
            </div>

            {exportType === "day" && (
              <input
                type="date"
                value={exportValue}
                max={todayString()}
                onChange={(e) => setExportValue(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}

            {exportType === "month" && (
              <input
                type="month"
                value={exportValue}
                max={currentMonth}
                onChange={(e) => setExportValue(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}

            {exportType === "year" && (
              <select
                value={exportValue}
                onChange={(e) => setExportValue(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Array.from({ length: 20 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleExport}
              disabled={exportLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {exportLoading ? "Exportando..." : "Exportar PDF"}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
