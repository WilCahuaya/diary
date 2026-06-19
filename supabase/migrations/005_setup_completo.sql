-- =============================================================================
-- SETUP COMPLETO: diario compartido (ejecutar TODO este archivo de una vez)
-- Supabase → SQL Editor → New query → Pegar → Run
-- =============================================================================

-- ── 1. Tabla diary_members ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diary_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7A6A98',
  is_owner BOOLEAN NOT NULL DEFAULT false,
  guest_can_write BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE diary_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select" ON diary_members;
DROP POLICY IF EXISTS "members_select_own" ON diary_members;
DROP POLICY IF EXISTS "members_select_all" ON diary_members;
CREATE POLICY "members_select_own" ON diary_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "members_select_all" ON diary_members
  FOR SELECT TO authenticated
  USING (public.is_diary_member());

DROP POLICY IF EXISTS "members_update_own" ON diary_members;
CREATE POLICY "members_update_own" ON diary_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 2. Función helper RLS ───────────────────────────────────────────────────

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

GRANT EXECUTE ON FUNCTION public.is_diary_member() TO authenticated;

-- ── 3. Fusionar entradas duplicadas (mismo día, distintas usuarias) ───────────

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
SET
  content = m.merged_content,
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entries_entry_date_key') THEN
    ALTER TABLE entries ADD CONSTRAINT entries_entry_date_key UNIQUE (entry_date);
  END IF;
END $$;

-- ── 4. Favoritos duplicados ─────────────────────────────────────────────────

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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_entry_date_key') THEN
    ALTER TABLE favorites ADD CONSTRAINT favorites_entry_date_key UNIQUE (entry_date);
  END IF;
END $$;

-- ── 5. Políticas RLS compartidas ────────────────────────────────────────────

DROP POLICY IF EXISTS "entries_select_own" ON entries;
DROP POLICY IF EXISTS "entries_insert_own" ON entries;
DROP POLICY IF EXISTS "entries_update_own" ON entries;
DROP POLICY IF EXISTS "entries_delete_own" ON entries;
DROP POLICY IF EXISTS "entries_select_member" ON entries;
DROP POLICY IF EXISTS "entries_insert_member" ON entries;
DROP POLICY IF EXISTS "entries_update_member" ON entries;
DROP POLICY IF EXISTS "entries_delete_member" ON entries;

CREATE POLICY "entries_select_member" ON entries FOR SELECT
  TO authenticated USING (is_diary_member());
CREATE POLICY "entries_insert_member" ON entries FOR INSERT
  TO authenticated WITH CHECK (is_diary_member());
CREATE POLICY "entries_update_member" ON entries FOR UPDATE
  TO authenticated USING (is_diary_member());
CREATE POLICY "entries_delete_member" ON entries FOR DELETE
  TO authenticated USING (is_diary_member());

DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
DROP POLICY IF EXISTS "favorites_update_own" ON favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
DROP POLICY IF EXISTS "favorites_select_member" ON favorites;
DROP POLICY IF EXISTS "favorites_insert_member" ON favorites;
DROP POLICY IF EXISTS "favorites_update_member" ON favorites;
DROP POLICY IF EXISTS "favorites_delete_member" ON favorites;

CREATE POLICY "favorites_select_member" ON favorites FOR SELECT
  TO authenticated USING (is_diary_member());
CREATE POLICY "favorites_insert_member" ON favorites FOR INSERT
  TO authenticated WITH CHECK (is_diary_member());
CREATE POLICY "favorites_update_member" ON favorites FOR UPDATE
  TO authenticated USING (is_diary_member());
CREATE POLICY "favorites_delete_member" ON favorites FOR DELETE
  TO authenticated USING (is_diary_member());

DROP POLICY IF EXISTS "images_select_own" ON images;
DROP POLICY IF EXISTS "images_insert_own" ON images;
DROP POLICY IF EXISTS "images_update_own" ON images;
DROP POLICY IF EXISTS "images_delete_own" ON images;
DROP POLICY IF EXISTS "images_select_member" ON images;
DROP POLICY IF EXISTS "images_insert_member" ON images;
DROP POLICY IF EXISTS "images_update_member" ON images;
DROP POLICY IF EXISTS "images_delete_member" ON images;

CREATE POLICY "images_select_member" ON images FOR SELECT
  TO authenticated USING (is_diary_member());
CREATE POLICY "images_insert_member" ON images FOR INSERT
  TO authenticated WITH CHECK (is_diary_member() AND user_id = auth.uid());
CREATE POLICY "images_update_member" ON images FOR UPDATE
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "images_delete_member" ON images FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ── 6. Storage (bucket diary-images) ────────────────────────────────────────

DROP POLICY IF EXISTS "diary_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "diary_images_select_member" ON storage.objects;

CREATE POLICY "diary_images_select_member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] IN (SELECT user_id::text FROM diary_members)
);

DROP POLICY IF EXISTS "diary_images_insert_own" ON storage.objects;
CREATE POLICY "diary_images_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "diary_images_update_own" ON storage.objects;
CREATE POLICY "diary_images_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "diary_images_delete_own" ON storage.objects;
CREATE POLICY "diary_images_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'diary-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── 7. Registrar las dos integrantes ────────────────────────────────────────

INSERT INTO diary_members (user_id, display_name, color, is_owner)
SELECT id, 'Willl', '#4D7563', true
FROM auth.users
WHERE email IN ('wcahuayaquispe@gmail.com', 'wcahuayaquispe@gamil.com')
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  color = EXCLUDED.color,
  is_owner = EXCLUDED.is_owner;

INSERT INTO diary_members (user_id, display_name, color, is_owner)
SELECT id, 'Anitaaa', '#7A6A98', false
FROM auth.users
WHERE email = 'anabujaico6@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  color = EXCLUDED.color,
  is_owner = EXCLUDED.is_owner;

-- ── 8. Verificar ────────────────────────────────────────────────────────────
-- Debe mostrar 2 filas (Wilca y Ana):
SELECT dm.display_name, dm.color, dm.is_owner, u.email
FROM diary_members dm
JOIN auth.users u ON u.id = dm.user_id;
