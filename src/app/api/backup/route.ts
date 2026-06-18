import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { BackupData } from "@/types/database";

const BUCKET = "diary-images";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Configura SUPABASE_SERVICE_ROLE_KEY para respaldos" },
      { status: 500 }
    );
  }

  const serviceClient = await createServiceClient();

  const [{ data: entries }, { data: favorites }, { data: images }] =
    await Promise.all([
      serviceClient.from("entries").select("*").eq("user_id", user.id),
      serviceClient.from("favorites").select("*").eq("user_id", user.id),
      serviceClient.from("images").select("*").eq("user_id", user.id),
    ]);

  const backup: BackupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    entries: entries ?? [],
    favorites: favorites ?? [],
    images: images ?? [],
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
}
