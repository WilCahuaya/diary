import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  requireUser,
  handleApiError,
  jsonWithCookies,
} from "@/lib/supabase/api";
import { requireWriteAccess } from "@/lib/members/server";
import { imageProxyPath } from "@/lib/content";
import type { DiaryImage } from "@/types/database";

const BUCKET = "diary-images";
const THUMB_SIZE = 400;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const runtime = "nodejs";
export const maxDuration = 60;

async function createThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buffer)
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.error("[api/images] sharp thumbnail failed:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, withCookies } = await requireUser(request);

    const { data: images, error } = await supabase
      .from("images")
      .select("*")
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

    await requireWriteAccess(supabase, user.id);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.type.startsWith("image/")) {
      return jsonWithCookies(withCookies, { error: "Archivo inválido" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return jsonWithCookies(
        withCookies,
        { error: "La imagen supera el límite de 8 MB" },
        { status: 400 }
      );
    }

    const imageId = randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, "") || "jpg";
    const originalPath = `${user.id}/originals/${imageId}.${ext}`;
    const thumbnailPath = `${user.id}/thumbnails/${imageId}.webp`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const thumbnail = await createThumbnail(buffer);

    const { error: origError } = await supabase.storage
      .from(BUCKET)
      .upload(originalPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (origError) {
      return jsonWithCookies(withCookies, { error: origError.message }, { status: 500 });
    }

    let storedThumbPath = thumbnailPath;
    if (thumbnail) {
      const { error: thumbError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbnailPath, thumbnail, {
          contentType: "image/webp",
          upsert: false,
        });

      if (thumbError) {
        // Minuatura opcional: seguir con el original
        console.error("[api/images] thumbnail upload failed:", thumbError.message);
        storedThumbPath = originalPath;
      }
    } else {
      storedThumbPath = originalPath;
    }

    const { error: dbError } = await supabase.from("images").insert({
      id: imageId,
      user_id: user.id,
      original_path: originalPath,
      thumbnail_path: storedThumbPath,
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
      thumbnail_path: storedThumbPath,
      original_path: originalPath,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
