const CONTEXT = 60;

export function extractSnippets(
  text: string,
  query: string,
  maxSnippets = 3
): string[] {
  if (!text || !query) return [];

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const snippets: string[] = [];
  let startIndex = 0;

  while (snippets.length < maxSnippets) {
    const idx = lowerText.indexOf(lowerQuery, startIndex);
    if (idx === -1) break;

    const start = Math.max(0, idx - CONTEXT);
    const end = Math.min(text.length, idx + query.length + CONTEXT);
    let snippet = text.slice(start, end).trim();

    if (start > 0) snippet = "..." + snippet;
    if (end < text.length) snippet = snippet + "...";

    snippets.push(snippet);
    startIndex = idx + query.length;
  }

  return snippets;
}

export function countMatches(text: string, query: string): number {
  if (!text || !query) return 0;
  const regex = new RegExp(escapeRegex(query), "gi");
  return (text.match(regex) ?? []).length;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
