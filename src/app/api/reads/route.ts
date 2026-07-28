import { NextRequest } from "next/server";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);
    const entryDate = new URL(request.url).searchParams.get("date");

    if (!entryDate) {
      return jsonWithCookies(withCookies, { error: "Falta date" }, { status: 400 });
    }

    const { data: members, error: membersError } = await supabase
      .from("diary_members")
      .select("user_id, display_name");

    if (membersError) {
      return jsonWithCookies(withCookies, { error: membersError.message }, { status: 500 });
    }

    const { data: reads, error: readsError } = await supabase
      .from("entry_reads")
      .select("user_id, last_read_at")
      .eq("entry_date", entryDate);

    if (readsError) {
      return jsonWithCookies(withCookies, { error: readsError.message }, { status: 500 });
    }

    const readMap = new Map(
      (reads ?? []).map((r: { user_id: string; last_read_at: string }) => [
        r.user_id,
        r.last_read_at,
      ])
    );

    const others = (members ?? [])
      .filter((m: { user_id: string }) => m.user_id !== user.id)
      .map((m: { user_id: string; display_name: string }) => ({
        userId: m.user_id,
        displayName: m.display_name,
        lastReadAt: readMap.get(m.user_id) ?? null,
      }));

    return jsonWithCookies(withCookies, { reads: others });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);
    const body = await request.json();
    const entryDate = body.entry_date as string | undefined;

    if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return jsonWithCookies(withCookies, { error: "Fecha inválida" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("entry_reads").upsert(
      {
        user_id: user.id,
        entry_date: entryDate,
        last_read_at: now,
      },
      { onConflict: "user_id,entry_date" }
    );

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    return jsonWithCookies(withCookies, { ok: true, lastReadAt: now });
  } catch (error) {
    return handleApiError(error);
  }
}
