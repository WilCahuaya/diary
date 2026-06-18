"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface FavoriteDialogProps {
  isFavorite: boolean;
  currentReason: string | null;
  onSave: (reason: string | null) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function FavoriteDialog({
  isFavorite,
  currentReason,
  onSave,
  onRemove,
  onClose,
}: FavoriteDialogProps) {
  const [reason, setReason] = useState(currentReason ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">
            {isFavorite ? "Editar favorito" : "Marcar como favorito"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1 block text-sm text-muted-foreground">
          Razón o descripción (opcional)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='Ej: "Mi graduación"'
          className="mb-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(reason.trim() || null)}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {isFavorite ? "Actualizar" : "Guardar favorito"}
          </button>
          {isFavorite && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-border px-4 py-2 text-sm text-destructive hover:bg-accent"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
