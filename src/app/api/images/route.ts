import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";
import { randomUUID } from "crypto";

const BUCKET = "diary-images";
const THUMB_SIZE = 400;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: images, error } = await supabase
    .from("images")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data: origUrl } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(img.original_path, 3600);
      const { data: thumbUrl } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(img.thumbnail_path, 3600);

      return {
        ...img,
        url: origUrl?.signedUrl ?? "",
        thumbUrl: thumbUrl?.signedUrl ?? origUrl?.signedUrl ?? "",
      };
    })
  );

  return NextResponse.json({ images: withUrls });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const imageId = randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const originalPath = `${user.id}/originals/${imageId}.${ext}`;
  const thumbnailPath = `${user.id}/thumbnails/${imageId}.webp`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const { error: origError } = await supabase.storage
    .from(BUCKET)
    .upload(originalPath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (origError) {
    return NextResponse.json({ error: origError.message }, { status: 500 });
  }

  const { error: thumbError } = await supabase.storage
    .from(BUCKET)
    .upload(thumbnailPath, thumbnail, {
      contentType: "image/webp",
      upsert: false,
    });

  if (thumbError) {
    await supabase.storage.from(BUCKET).remove([originalPath]);
    return NextResponse.json({ error: thumbError.message }, { status: 500 });
  }

  const { error: dbError } = await supabase.from("images").insert({
    id: imageId,
    user_id: user.id,
    original_path: originalPath,
    thumbnail_path: thumbnailPath,
    mime_type: file.type,
    size_bytes: buffer.length,
  });

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([originalPath, thumbnailPath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const { data: signedUrl } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(originalPath, 3600);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const proxyUrl = appUrl
    ? `${appUrl}/api/images/${imageId}/file`
    : `/api/images/${imageId}/file`;

  return NextResponse.json({
    id: imageId,
    url: proxyUrl,
    signedUrl: signedUrl?.signedUrl ?? proxyUrl,
    thumbnail_path: thumbnailPath,
    original_path: originalPath,
  });
}
