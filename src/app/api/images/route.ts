import { NextRequest } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";
import { imageProxyPath } from "@/lib/content";
import type { DiaryImage } from "@/types/database";

const BUCKET = "diary-images";
const THUMB_SIZE = 400;

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { data: images, error } = await supabase
      .from("images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonWithCookies(withCookies, { error: error.message }, { status: 500 });
    }

    const withUrls = (images ?? []).map((img: DiaryImage) => ({
      ...img,
      url: imageProxyPath(img.id),
      thumbUrl: imageProxyPath(img.id),
    }));

    return jsonWithCookies(withCookies, { images: withUrls });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.type.startsWith("image/")) {
      return jsonWithCookies(withCookies, { error: "Archivo inválido" }, { status: 400 });
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
      return jsonWithCookies(withCookies, { error: origError.message }, { status: 500 });
    }

    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbnailPath, thumbnail, {
        contentType: "image/webp",
        upsert: false,
      });

    if (thumbError) {
      await supabase.storage.from(BUCKET).remove([originalPath]);
      return jsonWithCookies(withCookies, { error: thumbError.message }, { status: 500 });
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
      return jsonWithCookies(withCookies, { error: dbError.message }, { status: 500 });
    }

    const url = imageProxyPath(imageId);

    return jsonWithCookies(withCookies, {
      id: imageId,
      url,
      thumbnail_path: thumbnailPath,
      original_path: originalPath,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
