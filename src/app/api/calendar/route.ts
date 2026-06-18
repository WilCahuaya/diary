import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CalendarDay } from "@/types/database";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [{ data: entries }, { data: favorites }] = await Promise.all([
    supabase
      .from("entries")
      .select("entry_date, content_plain")
      .eq("user_id", user.id)
      .neq("content_plain", ""),
    supabase.from("favorites").select("entry_date, reason").eq("user_id", user.id),
  ]);

  const dayMap = new Map<string, CalendarDay>();

  entries?.forEach((e) => {
    dayMap.set(e.entry_date, {
      entry_date: e.entry_date,
      has_content: true,
      is_favorite: false,
      favorite_reason: null,
    });
  });

  favorites?.forEach((f) => {
    const existing = dayMap.get(f.entry_date);
    if (existing) {
      existing.is_favorite = true;
      existing.favorite_reason = f.reason;
    } else {
      dayMap.set(f.entry_date, {
        entry_date: f.entry_date,
        has_content: false,
        is_favorite: true,
        favorite_reason: f.reason,
      });
    }
  });

  return NextResponse.json({ days: Array.from(dayMap.values()) });
}
