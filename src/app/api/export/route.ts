import { NextRequest } from "next/server";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import type { JSONContent } from "@tiptap/react";
import type { Entry } from "@/types/database";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";

export async function GET(request: NextRequest) {
  try {
    const { supabase, withCookies } = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const value = searchParams.get("value");

    if (!type || !value) {
      return jsonWithCookies(withCookies, { error: "Parámetros requeridos" }, { status: 400 });
    }

    let query = supabase.from("entries").select("*").order("entry_date", { ascending: true });

    if (type === "day") {
      query = query.eq("entry_date", value);
    } else if (type === "month") {
      const date = parseISO(`${value}-01`);
      const start = format(startOfMonth(date), "yyyy-MM-dd");
      const end = format(endOfMonth(date), "yyyy-MM-dd");
      query = query.gte("entry_date", start).lte("entry_date", end);
    } else if (type === "year") {
      query = query.gte("entry_date", `${value}-01-01`).lte("entry_date", `${value}-12-31`);
    } else {
      return jsonWithCookies(withCookies, { error: "Tipo inválido" }, { status: 400 });
    }

    const { data: entries, error } = await query;

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    const BUCKET = "diary-images";
    const enriched = await Promise.all(
      (entries ?? []).map(async (entry: Entry) => {
        const content = JSON.parse(JSON.stringify(entry.content)) as Record<string, unknown>;

        async function resolveImages(node: Record<string, unknown>) {
          if (node.type === "image" && typeof node.attrs === "object" && node.attrs) {
            const attrs = node.attrs as Record<string, unknown>;
            const imageId = (attrs.dataImageId ?? attrs["data-image-id"]) as string | undefined;

            if (imageId) {
              const { data: img } = await supabase
                .from("images")
                .select("original_path")
                .eq("id", imageId)
                .maybeSingle();

              if (img) {
                const { data: signed } = await supabase.storage
                  .from(BUCKET)
                  .createSignedUrl(img.original_path, 3600);
                if (signed?.signedUrl) attrs.src = signed.signedUrl;
              }
            }
          }
          const children = node.content as Record<string, unknown>[] | undefined;
          if (children) {
            for (const child of children) {
              await resolveImages(child);
            }
          }
        }

        await resolveImages(content as Record<string, unknown>);

        return { ...entry, content: content as JSONContent };
      })
    );

    return jsonWithCookies(withCookies, { entries: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}
