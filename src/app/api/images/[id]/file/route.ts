import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "diary-images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: image } = await supabase
    .from("images")
    .select("original_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!image) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(image.original_path, 3600);

  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Error al obtener imagen" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
