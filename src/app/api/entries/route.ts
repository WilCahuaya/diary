import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEditableDate } from "@/lib/dates";
import type { JSONContent } from "@tiptap/react";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  }

  const { data, error } = await supabase
    .from("entries")
    .select("entry_date, content_plain")
    .eq("user_id", user.id)
    .neq("content_plain", "")
    .order("entry_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { entry_date, content, content_plain } = body as {
    entry_date: string;
    content: JSONContent;
    content_plain: string;
  };

  if (!entry_date || !content) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (!isEditableDate(entry_date)) {
    return NextResponse.json(
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated_at: data.updated_at });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated_at: data.updated_at });
}
