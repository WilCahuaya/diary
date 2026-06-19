import { NextRequest } from "next/server";
import { isEditableDate } from "@/lib/dates";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";
import { requireWriteAccess } from "@/lib/members/server";

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { pending } = (await request.json()) as {
      pending: Array<{
        entryDate: string;
        content: unknown;
        contentPlain: string;
      }>;
    };

    await requireWriteAccess(supabase, user.id);

    let synced = 0;

    for (const save of pending ?? []) {
      if (!isEditableDate(save.entryDate)) continue;

      const { data: existing } = await supabase
        .from("entries")
        .select("id")
        .eq("entry_date", save.entryDate)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("entries")
          .update({
            content: save.content,
            content_plain: save.contentPlain,
            user_id: user.id,
          })
          .eq("id", existing.id);

        if (!error) synced++;
      } else {
        const { error } = await supabase.from("entries").insert({
          user_id: user.id,
          entry_date: save.entryDate,
          content: save.content,
          content_plain: save.contentPlain,
        });

        if (!error) synced++;
      }
    }

    return jsonWithCookies(withCookies, { synced });
  } catch (error) {
    return handleApiError(error);
  }
}
