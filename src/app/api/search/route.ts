import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countMatches, extractSnippets } from "@/lib/search/snippets";
import type { SearchResult } from "@/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data: entries, error } = await supabase
    .from("entries")
    .select("entry_date, content_plain")
    .eq("user_id", user.id)
    .ilike("content_plain", `%${query}%`)
    .order("entry_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: favorites } = await supabase
    .from("favorites")
    .select("entry_date")
    .eq("user_id", user.id);

  const favoriteSet = new Set(favorites?.map((f) => f.entry_date) ?? []);

  const results: SearchResult[] = (entries ?? []).map((entry) => ({
    entry_date: entry.entry_date,
    match_count: countMatches(entry.content_plain, query),
    snippets: extractSnippets(entry.content_plain, query),
    is_favorite: favoriteSet.has(entry.entry_date),
  }));

  return NextResponse.json({ results, query });
}
