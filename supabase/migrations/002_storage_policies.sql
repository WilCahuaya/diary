-- Bucket privado para imágenes del diario
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'diary-images',
  'diary-images',
  false,
  NULL,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas: cada usuario solo accede a su carpeta {user_id}/...
CREATE POLICY "diary_images_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "diary_images_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "diary_images_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "diary_images_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
