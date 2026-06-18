import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { JSONContent } from "@tiptap/react";

interface PendingSave {
  entryDate: string;
  content: JSONContent;
  contentPlain: string;
  timestamp: number;
}

interface DiaryOfflineDB extends DBSchema {
  pending_saves: {
    key: string;
    value: PendingSave;
  };
  cached_entries: {
    key: string;
    value: {
      entryDate: string;
      content: JSONContent;
      contentPlain: string;
      updatedAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<DiaryOfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<DiaryOfflineDB>("diary-offline", 1, {
      upgrade(db) {
        db.createObjectStore("pending_saves", { keyPath: "entryDate" });
        db.createObjectStore("cached_entries", { keyPath: "entryDate" });
      },
    });
  }
  return dbPromise;
}

export async function queuePendingSave(
  entryDate: string,
  content: JSONContent,
  contentPlain: string
) {
  const db = await getDB();
  await db.put("pending_saves", {
    entryDate,
    content,
    contentPlain,
    timestamp: Date.now(),
  });
}

export async function getPendingSaves(): Promise<PendingSave[]> {
  const db = await getDB();
  return db.getAll("pending_saves");
}

export async function removePendingSave(entryDate: string) {
  const db = await getDB();
  await db.delete("pending_saves", entryDate);
}

export async function cacheEntry(
  entryDate: string,
  content: JSONContent,
  contentPlain: string,
  updatedAt: string
) {
  const db = await getDB();
  await db.put("cached_entries", {
    entryDate,
    content,
    contentPlain,
    updatedAt,
  });
}

export async function getCachedEntry(entryDate: string) {
  const db = await getDB();
  return db.get("cached_entries", entryDate);
}
