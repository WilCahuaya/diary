"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { exportEntriesToPdf } from "@/lib/export/pdf";
import { authorColorVar } from "@/lib/theme";
import type { DiaryMember, Entry, MembersResponse } from "@/types/database";
import { todayString } from "@/lib/dates";
import { format } from "date-fns";

export default function SettingsPage() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<"day" | "month" | "year">("day");
  const [exportValue, setExportValue] = useState(todayString());
  const [profile, setProfile] = useState<DiaryMember | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nameLoading, setNameLoading] = useState(true);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [guestCanWrite, setGuestCanWrite] = useState(true);
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestMessage, setGuestMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/members")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as MembersResponse;
      })
      .then((data) => {
        if (data) {
          setProfile(data.current);
          setDisplayName(data.current.displayName);
          setGuestCanWrite(data.guestCanWrite);
        }
      })
      .finally(() => setNameLoading(false));
  }, []);

  async function handleSaveName() {
    setNameMessage(null);
    setNameSaving(true);
    try {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = (await res.json()) as { current?: DiaryMember; error?: string };

      if (!res.ok) {
        setNameMessage(data.error ?? "No se pudo guardar el nombre");
        return;
      }

      if (data.current) {
        setProfile(data.current);
        setDisplayName(data.current.displayName);
        setNameMessage("Nombre actualizado");
      }
    } finally {
      setNameSaving(false);
    }
  }

  const nameChanged =
    profile !== null && displayName.trim() !== profile.displayName;

  async function handleGuestWriteChange(enabled: boolean) {
    setGuestMessage(null);
    setGuestSaving(true);
    setGuestCanWrite(enabled);
    try {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestCanWrite: enabled }),
      });
      const data = (await res.json()) as { guestCanWrite?: boolean; error?: string };

      if (!res.ok) {
        setGuestCanWrite(!enabled);
        setGuestMessage(data.error ?? "No se pudo guardar");
        return;
      }

      if (typeof data.guestCanWrite === "boolean") {
        setGuestCanWrite(data.guestCanWrite);
      }
      setGuestMessage(enabled ? "La otra integrante ya puede escribir" : "Solo lectura activada");
    } finally {
      setGuestSaving(false);
    }
  }

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

        {(nameLoading || !profile || profile.canWrite) && (
        <section className="mb-10">
          <h2 className="mb-1 text-sm font-medium">Tu nombre en el diario</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Así aparecerás en la leyenda y en el texto que escribas. Cada una puede
            cambiar solo su propio nombre.
          </p>
          <div className="space-y-3 rounded-xl border border-border p-4">
            {nameLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : profile ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: authorColorVar(profile.isOwner) }}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={displayName}
                    maxLength={40}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setNameMessage(null);
                    }}
                    placeholder="Tu nombre"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={nameSaving || !displayName.trim() || !nameChanged}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {nameSaving ? "Guardando..." : "Guardar nombre"}
                </button>
                {nameMessage ? (
                  <p
                    className={`text-sm ${
                      nameMessage === "Nombre actualizado"
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {nameMessage}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No se pudo cargar tu perfil.
              </p>
            )}
          </div>
        </section>
        )}

        {profile?.isOwner ? (
          <section className="mb-10">
            <h2 className="mb-1 text-sm font-medium">Permisos de la otra integrante</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Decide si la otra persona puede escribir en el diario o solo ver las
              entradas.
            </p>
            <div className="space-y-3 rounded-xl border border-border p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={guestCanWrite}
                  disabled={guestSaving}
                  onChange={(e) => handleGuestWriteChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span className="text-left text-sm">
                  <span className="font-medium">Permitir que escriba</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {guestCanWrite
                      ? "Puede editar hoy y ayer, subir imágenes y marcar favoritos."
                      : "Solo puede leer el diario; no puede modificar nada."}
                  </span>
                </span>
              </label>
              {guestMessage ? (
                <p className="text-sm text-muted-foreground">{guestMessage}</p>
              ) : null}
            </div>
          </section>
        ) : profile && !profile.canWrite ? (
          <section className="mb-10">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Tienes acceso de solo lectura. El dueño del diario desactivó la
              edición para tu cuenta.
            </div>
          </section>
        ) : null}

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
