import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEditableDate } from "@/lib/dates";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { pending } = (await request.json()) as {
    pending: Array<{
      entryDate: string;
      content: unknown;
      contentPlain: string;
    }>;
  };

  let synced = 0;

  for (const save of pending ?? []) {
    if (!isEditableDate(save.entryDate)) continue;

    const { data: existing } = await supabase
      .from("entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("entry_date", save.entryDate)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("entries")
        .update({
          content: save.content,
          content_plain: save.contentPlain,
        })
        .eq("id", existing.id);

      if (!error) {
        synced++;
      }
    } else {
      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        entry_date: save.entryDate,
        content: save.content,
        content_plain: save.contentPlain,
      });

      if (!error) {
        synced++;
      }
    }
  }

  return NextResponse.json({ synced });
}
