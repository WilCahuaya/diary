"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordReady, setPasswordReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordTypedByUser = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  const clearPassword = useCallback(() => {
    setPassword("");
    if (passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, []);

  const rejectAutofilledPassword = useCallback(() => {
    if (!passwordTypedByUser.current) {
      clearPassword();
    }
  }, [clearPassword]);

  useEffect(() => {
    clearPassword();
    const delays = [100, 300, 500];
    const timers = delays.map((delay) =>
      setTimeout(() => {
        const el = passwordRef.current;
        if (el?.value && !passwordTypedByUser.current) {
          clearPassword();
        }
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [clearPassword]);

  function handlePasswordFocus() {
    setPasswordReady(true);
    const delays = [50, 150, 400];
    delays.forEach((delay) => {
      setTimeout(rejectAutofilledPassword, delay);
    });
  }

  function handlePasswordAnimationStart(e: React.AnimationEvent<HTMLInputElement>) {
    if (e.animationName === "onAutoFillStart") {
      rejectAutofilledPassword();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas.");
      setLoading(false);
      return;
    }

    router.push("/diary/today");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Mi Diario</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu espacio privado para escribir
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-muted-foreground">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-muted-foreground">
              Contraseña
            </label>
            <input
              ref={passwordRef}
              id="password"
              name="diary-password"
              type="password"
              value={password}
              onKeyDown={() => {
                passwordTypedByUser.current = true;
              }}
              onChange={(e) => {
                if (!passwordTypedByUser.current) {
                  rejectAutofilledPassword();
                  return;
                }
                setPassword(e.target.value);
              }}
              onInput={() => {
                if (!passwordTypedByUser.current) {
                  rejectAutofilledPassword();
                }
              }}
              onAnimationStart={handlePasswordAnimationStart}
              onFocus={handlePasswordFocus}
              readOnly={!passwordReady}
              required
              autoComplete="new-password"
              className="login-password-field w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-foreground underline-offset-4 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </div>
  );
}
