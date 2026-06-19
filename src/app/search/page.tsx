"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, Star } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { formatShortDate } from "@/lib/utils";
import type { SearchResult } from "@/types/database";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
        <h1 className="mb-6 text-xl font-medium">Buscar</h1>

        <div className="relative mb-8">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar palabras o frases..."
            autoFocus
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Buscando...</p>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No se encontraron resultados para &ldquo;{query}&rdquo;.
          </p>
        )}

        <div className="space-y-6">
          {results.map((result) => (
            <Link
              key={result.entry_date}
              href={`/diary/${result.entry_date}`}
              className="block rounded-xl border border-border p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium">{formatShortDate(result.entry_date)}</span>
                <span className="text-xs text-muted-foreground">
                  ({result.match_count}{" "}
                  {result.match_count === 1 ? "coincidencia" : "coincidencias"})
                </span>
                {result.is_favorite && (
                  <Star className="h-3.5 w-3.5 fill-favorite text-favorite" />
                )}
              </div>
              <div className="space-y-1.5">
                {result.snippets.map((snippet, i) => (
                  <p
                    key={i}
                    className={cn(
                      "text-sm text-muted-foreground leading-relaxed",
                      "border-l-2 border-border pl-3"
                    )}
                  >
                    &ldquo;{highlightQuery(snippet, query)}&rdquo;
                  </p>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

function highlightQuery(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-200/60 px-0.5 dark:bg-yellow-800/40">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
