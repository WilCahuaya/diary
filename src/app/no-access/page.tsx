"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NoAccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-xl font-semibold">Permiso denegado</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          No se ha configurado acceso para esta cuenta.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Cerrando sesión..." : "Cerrar sesión e ir al login"}
        </button>
      </div>
    </div>
  );
}
