import { NextRequest } from "next/server";
import { isEditableDate } from "@/lib/dates";
import type { JSONContent } from "@tiptap/react";
import type { AuthorProfile } from "@/lib/editor/author-mark";
import { normalizeImageUrls, syncAuthorMarks, tagLegacyAuthorship } from "@/lib/content";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";
import { requireWriteAccess } from "@/lib/members/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const entryDate = searchParams.get("date");

    if (entryDate) {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("entry_date", entryDate)
        .maybeSingle();

      if (error) {
        return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
      }

      const { data: members } = await supabase
        .from("diary_members")
        .select("user_id, display_name, color, is_owner");

      const memberProfiles: AuthorProfile[] =
        members?.map((m: {
          user_id: string;
          display_name: string;
          color: string;
          is_owner: boolean;
        }) => ({
          userId: m.user_id,
          displayName: m.display_name,
          color: m.color,
          isOwner: m.is_owner,
        })) ?? [];

      const owner = memberProfiles.find((m) => m.isOwner);

      let content = data?.content as JSONContent | undefined;
      if (content) {
        content = normalizeImageUrls(content);
        if (owner) {
          content = tagLegacyAuthorship(content, owner);
        }
        if (memberProfiles.length) {
          content = syncAuthorMarks(content, memberProfiles);
        }
      }

      const entry = data ? { ...data, content: content ?? data.content } : null;

      return jsonWithCookies(withCookies, { entry });
    }

    const { data, error } = await supabase
      .from("entries")
      .select("entry_date, content_plain")
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

    await requireWriteAccess(supabase, user.id);

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
      .eq("entry_date", entry_date)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("entries")
        .update({ content, content_plain, user_id: user.id })
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
