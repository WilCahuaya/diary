-- Diario compartido: dos usuarias, una entrada por día

CREATE TABLE diary_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE diary_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON diary_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM diary_members dm WHERE dm.user_id = auth.uid()));

CREATE POLICY "members_update_own" ON diary_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Función helper para RLS
CREATE OR REPLACE FUNCTION public.is_diary_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM diary_members WHERE user_id = auth.uid()
  );
$$;

-- Entradas: una por día (compartida)
-- Fusionar duplicados existentes (p. ej. una entrada por usuaria)
WITH dup_dates AS (
  SELECT entry_date FROM entries GROUP BY entry_date HAVING COUNT(*) > 1
),
keepers AS (
  SELECT DISTINCT ON (e.entry_date) e.id, e.entry_date
  FROM entries e
  WHERE e.entry_date IN (SELECT entry_date FROM dup_dates)
  ORDER BY e.entry_date, e.updated_at DESC
),
merged AS (
  SELECT
    k.id AS keeper_id,
    k.entry_date,
    jsonb_build_object(
      'type', 'doc',
      'content', COALESCE(
        (
          SELECT jsonb_agg(block ORDER BY sub.updated_at)
          FROM entries sub
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(sub.content -> 'content') = 'array'
              THEN sub.content -> 'content'
              ELSE '[]'::jsonb
            END
          ) AS block
          WHERE sub.entry_date = k.entry_date
        ),
        '[]'::jsonb
      )
    ) AS merged_content,
    (
      SELECT string_agg(sub.content_plain, ' ' ORDER BY sub.updated_at)
      FROM entries sub
      WHERE sub.entry_date = k.entry_date
    ) AS merged_plain
  FROM keepers k
)
UPDATE entries e
SET content = m.merged_content,
    content_plain = COALESCE(m.merged_plain, ''),
    updated_at = now()
FROM merged m
WHERE e.id = m.keeper_id;

DELETE FROM entries e
USING (SELECT entry_date FROM entries GROUP BY entry_date HAVING COUNT(*) > 1) d
WHERE e.entry_date = d.entry_date
  AND e.id NOT IN (
    SELECT DISTINCT ON (entry_date) id
    FROM entries WHERE entry_date = d.entry_date
    ORDER BY entry_date, updated_at DESC
  );

ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_user_id_entry_date_key;
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_entry_date_key;
ALTER TABLE entries ADD CONSTRAINT entries_entry_date_key UNIQUE (entry_date);

DROP POLICY IF EXISTS "entries_select_own" ON entries;
DROP POLICY IF EXISTS "entries_insert_own" ON entries;
DROP POLICY IF EXISTS "entries_update_own" ON entries;
DROP POLICY IF EXISTS "entries_delete_own" ON entries;

CREATE POLICY "entries_select_member" ON entries FOR SELECT
  TO authenticated USING (is_diary_member());
CREATE POLICY "entries_insert_member" ON entries FOR INSERT
  TO authenticated WITH CHECK (is_diary_member());
CREATE POLICY "entries_update_member" ON entries FOR UPDATE
  TO authenticated USING (is_diary_member());
CREATE POLICY "entries_delete_member" ON entries FOR DELETE
  TO authenticated USING (is_diary_member());

-- Favoritos: compartidos por día
DELETE FROM favorites f
USING (SELECT entry_date FROM favorites GROUP BY entry_date HAVING COUNT(*) > 1) d
WHERE f.entry_date = d.entry_date
  AND f.id NOT IN (
    SELECT DISTINCT ON (entry_date) id
    FROM favorites WHERE entry_date = d.entry_date
    ORDER BY entry_date, created_at DESC
  );

ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_entry_date_key;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_entry_date_key;
ALTER TABLE favorites ADD CONSTRAINT favorites_entry_date_key UNIQUE (entry_date);

DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
DROP POLICY IF EXISTS "favorites_update_own" ON favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;

CREATE POLICY "favorites_select_member" ON favorites FOR SELECT
  TO authenticated USING (is_diary_member());
CREATE POLICY "favorites_insert_member" ON favorites FOR INSERT
  TO authenticated WITH CHECK (is_diary_member());
CREATE POLICY "favorites_update_member" ON favorites FOR UPDATE
  TO authenticated USING (is_diary_member());
CREATE POLICY "favorites_delete_member" ON favorites FOR DELETE
  TO authenticated USING (is_diary_member());

-- Imágenes: todas las integrantes pueden ver las del diario
DROP POLICY IF EXISTS "images_select_own" ON images;
DROP POLICY IF EXISTS "images_insert_own" ON images;
DROP POLICY IF EXISTS "images_update_own" ON images;
DROP POLICY IF EXISTS "images_delete_own" ON images;

CREATE POLICY "images_select_member" ON images FOR SELECT
  TO authenticated USING (
    is_diary_member()
    AND user_id IN (SELECT dm.user_id FROM diary_members dm)
  );
CREATE POLICY "images_insert_member" ON images FOR INSERT
  TO authenticated WITH CHECK (is_diary_member() AND user_id = auth.uid());
CREATE POLICY "images_update_member" ON images FOR UPDATE
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "images_delete_member" ON images FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Storage: ver imágenes de cualquier integrante
DROP POLICY IF EXISTS "diary_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_delete_own" ON storage.objects;

CREATE POLICY "diary_images_select_member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] IN (
    SELECT user_id::text FROM diary_members
  )
);

CREATE POLICY "diary_images_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "diary_images_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "diary_images_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Registrar integrantes (reemplaza los UUID por los reales de Authentication → Users)
-- INSERT INTO diary_members (user_id, display_name, color, is_owner) VALUES
--   ('UUID-DUENA', 'Wilca', '#1e40af', true),
--   ('UUID-INVITADA', 'Nombre', '#be185d', false);

COMMENT ON TABLE diary_members IS 'Exactamente 2 usuarias con acceso al mismo diario';
