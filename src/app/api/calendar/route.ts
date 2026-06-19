import { NextRequest } from "next/server";
import type { CalendarDay } from "@/types/database";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  try {
    const { supabase, withCookies } = await requireUser(request);

    const [{ data: entries }, { data: favorites }] = await Promise.all([
      supabase.from("entries").select("entry_date, content_plain").neq("content_plain", ""),
      supabase.from("favorites").select("entry_date, reason"),
    ]);

    const dayMap = new Map<string, CalendarDay>();

    entries?.forEach((e: { entry_date: string }) => {
      dayMap.set(e.entry_date, {
        entry_date: e.entry_date,
        has_content: true,
        is_favorite: false,
        favorite_reason: null,
      });
    });

    favorites?.forEach((f: { entry_date: string; reason: string | null }) => {
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

    return jsonWithCookies(withCookies, { days: Array.from(dayMap.values()) });
  } catch (error) {
    return handleApiError(error);
  }
}
