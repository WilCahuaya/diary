import { NextRequest } from "next/server";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const entryDate = searchParams.get("date");

    if (!entryDate) {
      return jsonWithCookies(withCookies, { error: "Fecha requerida" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", entryDate)
      .maybeSingle();

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    return jsonWithCookies(withCookies, { favorite: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { entry_date, reason } = (await request.json()) as {
      entry_date: string;
      reason: string | null;
    };

    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("entry_date", entry_date)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("favorites")
        .update({ reason })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
      }
      return jsonWithCookies(withCookies, { favorite: data });
    }

    const { data, error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, entry_date, reason })
      .select()
      .single();

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    return jsonWithCookies(withCookies, { favorite: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const entryDate = searchParams.get("date");

    if (!entryDate) {
      return jsonWithCookies(withCookies, { error: "Fecha requerida" }, { status: 400 });
    }

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("entry_date", entryDate);

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    return jsonWithCookies(withCookies, { success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
