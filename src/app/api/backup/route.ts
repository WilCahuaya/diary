import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createServiceClient } from "@/lib/supabase/server";
import type { BackupData } from "@/types/database";
import { requireUser, handleApiError } from "@/lib/supabase/api";

const BUCKET = "diary-images";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Configura SUPABASE_SERVICE_ROLE_KEY para respaldos" },
        { status: 500 }
      );
    }

    const serviceClient = await createServiceClient();

    const [{ data: entries }, { data: favorites }, { data: images }, { data: members }] =
      await Promise.all([
        serviceClient.from("entries").select("*"),
        serviceClient.from("favorites").select("*"),
        serviceClient.from("images").select("*"),
        serviceClient.from("diary_members").select("*"),
      ]);

    const backup: BackupData = {
      version: 2,
      exported_at: new Date().toISOString(),
      entries: entries ?? [],
      favorites: favorites ?? [],
      images: images ?? [],
      members: members ?? [],
    };

    const zip = new JSZip();
    zip.file("database.json", JSON.stringify(backup, null, 2));

    const originals = zip.folder("images/originals");
    const thumbnails = zip.folder("images/thumbnails");

    for (const img of images ?? []) {
      const { data: origData } = await serviceClient.storage
        .from(BUCKET)
        .download(img.original_path);

      if (origData) {
        const origBuffer = Buffer.from(await origData.arrayBuffer());
        const origName = img.original_path.split("/").pop() ?? `${img.id}.bin`;
        originals?.file(origName, origBuffer);
      }

      const { data: thumbData } = await serviceClient.storage
        .from(BUCKET)
        .download(img.thumbnail_path);

      if (thumbData) {
        const thumbBuffer = Buffer.from(await thumbData.arrayBuffer());
        const thumbName = img.thumbnail_path.split("/").pop() ?? `${img.id}.webp`;
        thumbnails?.file(thumbName, thumbBuffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const filename = `diario-respaldo-${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
