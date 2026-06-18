import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const value = searchParams.get("value");

  if (!type || !value) {
    return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  }

  let query = supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: true });

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
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userId = user.id;

  // Resolve image URLs in content for PDF export
  const BUCKET = "diary-images";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const enriched = await Promise.all(
    (entries ?? []).map(async (entry) => {
      const content = JSON.parse(JSON.stringify(entry.content)) as Record<string, unknown>;

      async function resolveImages(node: Record<string, unknown>) {
        if (node.type === "image" && typeof node.attrs === "object" && node.attrs) {
          const attrs = node.attrs as Record<string, unknown>;
          const src = attrs.src as string;
          const imageId = (attrs.dataImageId ?? attrs["data-image-id"]) as
            | string
            | undefined;

          if (imageId) {
            const { data: img } = await supabase
              .from("images")
              .select("original_path")
              .eq("id", imageId)
              .eq("user_id", userId)
              .maybeSingle();

            if (img) {
              const { data: signed } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(img.original_path, 3600);
              if (signed?.signedUrl) attrs.src = signed.signedUrl;
            }
          } else if (src?.includes("/api/images/") && appUrl) {
            attrs.src = `${appUrl}${src.startsWith("/") ? src : `/${src}`}`;
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

      return {
        ...entry,
        content,
      };
    })
  );

  return NextResponse.json({ entries: enriched });
}
