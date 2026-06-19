import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function createClientFromRequest(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno de Vercel"
    );
  }

  let pendingCookies: Array<{
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies = cookiesToSet;
      },
    },
  });

  function withCookies<T extends NextResponse>(response: T): T {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return { supabase, withCookies };
}

export async function requireUser(request: NextRequest): Promise<{
  supabase: ReturnType<typeof createServerClient>;
  user: User;
  withCookies: <T extends NextResponse>(response: T) => T;
}> {
  const { supabase, withCookies } = createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new AuthError("No autorizado");
  }

  return { supabase, user, withCookies };
}

export class AuthError extends Error {
  status = 401;

  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  status = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("[api]", error);

  const message =
    error instanceof Error ? error.message : "Error interno del servidor";

  return NextResponse.json({ error: message }, { status: 500 });
}

export function jsonWithCookies(
  withCookies: <T extends NextResponse>(response: T) => T,
  body: unknown,
  init?: ResponseInit
) {
  const response = NextResponse.json(body, init);
  return withCookies(response);
}
