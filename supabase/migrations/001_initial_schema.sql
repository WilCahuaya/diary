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
