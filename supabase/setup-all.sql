-- Mi Diario — setup completo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query

-- Diario personal: esquema inicial
-- Preparado para futuras extensiones de IA (pgvector, embeddings)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Entradas del diario (una por día)
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_plain TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Favoritos por día
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Metadatos de imágenes (archivos en Storage)
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX idx_entries_fts ON entries USING gin(to_tsvector('spanish', content_plain));
CREATE INDEX idx_favorites_user ON favorites(user_id, entry_date);
CREATE INDEX idx_images_user ON images(user_id, created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_select_own" ON entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "entries_insert_own" ON entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update_own" ON entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "entries_delete_own" ON entries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "favorites_select_own" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_update_own" ON favorites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "images_select_own" ON images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "images_insert_own" ON images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "images_delete_own" ON images FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "images_update_own" ON images FOR UPDATE USING (auth.uid() = user_id);

-- Columna reservada para futura búsqueda semántica
COMMENT ON TABLE entries IS 'Diario personal. content_plain para FTS; futuro: embedding vector en extensión separada';


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

