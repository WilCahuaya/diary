import { parse, serialize } from "cookie";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/** Cookies de sesión: se borran al cerrar el navegador (sin maxAge ni expires). */
export function asSessionCookieOptions(
  options: Partial<ResponseCookie> = {}
): Partial<ResponseCookie> {
  const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
  return sessionOptions;
}

export function createBrowserSupabaseCookies() {
  return {
    getAll() {
      if (typeof document === "undefined") return [];
      const parsed = parse(document.cookie);
      return Object.keys(parsed).map((name) => ({
        name,
        value: parsed[name] ?? "",
      }));
    },
    setAll(
      cookiesToSet: Array<{
        name: string;
        value: string;
        options?: Partial<ResponseCookie>;
      }>
    ) {
      cookiesToSet.forEach(({ name, value, options }) => {
        document.cookie = serialize(
          name,
          value,
          asSessionCookieOptions(options ?? {}) as Parameters<typeof serialize>[2]
        );
      });
    },
  };
}
