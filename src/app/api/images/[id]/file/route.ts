import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";

const BUCKET = "diary-images";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, withCookies } = await requireUser(request);

    const { data: image, error } = await supabase
      .from("images")
      .select("original_path, mime_type")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    if (!image) {
      return jsonWithCookies(withCookies, { error: "No encontrada" }, { status: 404 });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(image.original_path);

    if (downloadError || !file) {
      return jsonWithCookies(
        withCookies,
        { error: downloadError?.message ?? "No se pudo descargar" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    return withCookies(
      new NextResponse(buffer, {
        headers: {
          "Content-Type": image.mime_type,
          "Cache-Control": "private, max-age=3600",
        },
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
