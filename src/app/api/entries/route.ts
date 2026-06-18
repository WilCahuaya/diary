import { NextRequest } from "next/server";
import { isEditableDate } from "@/lib/dates";
import type { JSONContent } from "@tiptap/react";
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

    if (entryDate) {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_date", entryDate)
        .maybeSingle();

      if (error) {
        return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
      }

      return jsonWithCookies(withCookies, { entry: data });
    }

    const { data, error } = await supabase
      .from("entries")
      .select("entry_date, content_plain")
      .eq("user_id", user.id)
      .neq("content_plain", "")
      .order("entry_date", { ascending: false });

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    return jsonWithCookies(withCookies, { entries: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const body = await request.json();
    const { entry_date, content, content_plain } = body as {
      entry_date: string;
      content: JSONContent;
      content_plain: string;
    };

    if (!entry_date || !content) {
      return jsonWithCookies(withCookies, { error: "Datos incompletos" }, { status: 400 });
    }

    if (!isEditableDate(entry_date)) {
      return jsonWithCookies(
        withCookies,
        { error: "Solo puedes editar entradas de hoy o ayer" },
        { status: 403 }
      );
    }

    const { data: existing } = await supabase
      .from("entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("entry_date", entry_date)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("entries")
        .update({ content, content_plain })
        .eq("id", existing.id)
        .select("updated_at")
        .single();

      if (error) {
        return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
      }

      return jsonWithCookies(withCookies, { updated_at: data.updated_at });
    }

    const { data, error } = await supabase
      .from("entries")
      .insert({
        user_id: user.id,
        entry_date,
        content,
        content_plain,
      })
      .select("updated_at")
      .single();

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    return jsonWithCookies(withCookies, { updated_at: data.updated_at });
  } catch (error) {
    return handleApiError(error);
  }
}
