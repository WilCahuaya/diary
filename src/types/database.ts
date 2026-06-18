import type { JSONContent } from "@tiptap/react";

export interface Entry {
  id: string;
  user_id: string;
  entry_date: string;
  content: JSONContent;
  content_plain: string;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  entry_date: string;
  reason: string | null;
  created_at: string;
}

export interface DiaryImage {
  id: string;
  user_id: string;
  original_path: string;
  thumbnail_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface SearchResult {
  entry_date: string;
  match_count: number;
  snippets: string[];
  is_favorite: boolean;
}

export interface CalendarDay {
  entry_date: string;
  has_content: boolean;
  is_favorite: boolean;
  favorite_reason: string | null;
}

export interface BackupData {
  version: 1;
  exported_at: string;
  entries: Entry[];
  favorites: Favorite[];
  images: DiaryImage[];
}
