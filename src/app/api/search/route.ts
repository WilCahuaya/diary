import { NextRequest } from "next/server";
import { countMatches, extractSnippets } from "@/lib/search/snippets";
import type { SearchResult } from "@/types/database";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  try {
    const { supabase, withCookies } = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return jsonWithCookies(withCookies, { results: [] });
    }

    const { data: entries, error } = await supabase
      .from("entries")
      .select("entry_date, content_plain")
      .ilike("content_plain", `%${query}%`)
      .order("entry_date", { ascending: false });

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    const { data: favorites } = await supabase.from("favorites").select("entry_date");

    const favoriteSet = new Set(
      favorites?.map((f: { entry_date: string }) => f.entry_date) ?? []
    );

    const results: SearchResult[] = (entries ?? []).map(
      (entry: { entry_date: string; content_plain: string }) => ({
      entry_date: entry.entry_date,
      match_count: countMatches(entry.content_plain, query),
      snippets: extractSnippets(entry.content_plain, query),
      is_favorite: favoriteSet.has(entry.entry_date),
      })
    );

    return jsonWithCookies(withCookies, { results, query });
  } catch (error) {
    return handleApiError(error);
  }
}
