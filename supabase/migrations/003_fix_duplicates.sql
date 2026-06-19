-- Corregir entradas duplicadas antes de la restricción UNIQUE(entry_date)
-- Ejecutar si falló: could not create unique index "entries_entry_date_key"

-- 1. Fusionar entradas del mismo día en una sola
WITH dup_dates AS (
  SELECT entry_date
  FROM entries
  GROUP BY entry_date
  HAVING COUNT(*) > 1
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
SET
  content = m.merged_content,
  content_plain = COALESCE(m.merged_plain, ''),
  updated_at = now()
FROM merged m
WHERE e.id = m.keeper_id;

-- 2. Eliminar duplicados (conservar el más reciente por día)
DELETE FROM entries e
USING (
  SELECT entry_date
  FROM entries
  GROUP BY entry_date
  HAVING COUNT(*) > 1
) d
WHERE e.entry_date = d.entry_date
  AND e.id NOT IN (
    SELECT DISTINCT ON (entry_date) id
    FROM entries
    WHERE entry_date = d.entry_date
    ORDER BY entry_date, updated_at DESC
  );

-- 3. Aplicar UNIQUE en entries (si aún no existe)
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_user_id_entry_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entries_entry_date_key'
  ) THEN
    ALTER TABLE entries ADD CONSTRAINT entries_entry_date_key UNIQUE (entry_date);
  END IF;
END $$;

-- 4. Fusionar favoritos duplicados del mismo día
WITH dup_fav AS (
  SELECT entry_date
  FROM favorites
  GROUP BY entry_date
  HAVING COUNT(*) > 1
),
keepers_fav AS (
  SELECT DISTINCT ON (f.entry_date) f.id, f.entry_date
  FROM favorites f
  WHERE f.entry_date IN (SELECT entry_date FROM dup_fav)
  ORDER BY f.entry_date, f.created_at DESC
)
UPDATE favorites f
SET reason = COALESCE(
  (
    SELECT string_agg(sub.reason, ' / ' ORDER BY sub.created_at)
    FROM favorites sub
    WHERE sub.entry_date = f.entry_date AND sub.reason IS NOT NULL
  ),
  f.reason
)
FROM keepers_fav k
WHERE f.id = k.id;

DELETE FROM favorites f
USING (
  SELECT entry_date FROM favorites GROUP BY entry_date HAVING COUNT(*) > 1
) d
WHERE f.entry_date = d.entry_date
  AND f.id NOT IN (
    SELECT DISTINCT ON (entry_date) id
    FROM favorites
    WHERE entry_date = d.entry_date
    ORDER BY entry_date, created_at DESC
  );

ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_entry_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_entry_date_key'
  ) THEN
    ALTER TABLE favorites ADD CONSTRAINT favorites_entry_date_key UNIQUE (entry_date);
  END IF;
END $$;

-- Verificar: no debe devolver filas
-- SELECT entry_date, COUNT(*) FROM entries GROUP BY entry_date HAVING COUNT(*) > 1;
