import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { asSessionCookieOptions } from "@/lib/supabase/session-cookies";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/auth/callback", "/no-access"];

async function isDiaryMember(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_diary_member");
  if (!error && typeof data === "boolean") {
    return data;
  }

  const { data: row } = await supabase
    .from("diary_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !!row;
}

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, asSessionCookieOptions(options ?? {}))
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!user && !isPublic && !pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic && !pathname.startsWith("/api") && pathname !== "/no-access") {
    const member = await isDiaryMember(supabase, user.id);

    if (!member) {
      const url = request.nextUrl.clone();
      url.pathname = "/no-access";
      return NextResponse.redirect(url);
    }
  }

  if (user && (pathname === "/login" || pathname === "/forgot-password")) {
    const member = await isDiaryMember(supabase, user.id);

    if (member) {
      const url = request.nextUrl.clone();
      url.pathname = "/diary/today";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname === "/") {
    const member = await isDiaryMember(supabase, user.id);

    const url = request.nextUrl.clone();
    url.pathname = member ? "/diary/today" : "/no-access";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
