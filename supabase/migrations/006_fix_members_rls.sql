-- Corrige RLS de diary_members: antes solo podías leer la tabla si ya eras miembro
-- (dependencia circular). Ejecutar en Supabase → SQL Editor.

GRANT EXECUTE ON FUNCTION public.is_diary_member() TO authenticated;

DROP POLICY IF EXISTS "members_select" ON diary_members;
DROP POLICY IF EXISTS "members_select_own" ON diary_members;
DROP POLICY IF EXISTS "members_select_all" ON diary_members;

-- Cada usuaria puede leer su propia fila (middleware y comprobaciones básicas)
CREATE POLICY "members_select_own" ON diary_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Las integrantes pueden ver a todas (leyenda de autoras, API /members)
CREATE POLICY "members_select_all" ON diary_members
  FOR SELECT TO authenticated
  USING (public.is_diary_member());

-- Re-registrar integrantes por si el seed anterior no encontró el email
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

-- Verificar (debe mostrar Wilca y Ana si ambas tienen cuenta en Auth):
SELECT dm.display_name, u.email
FROM diary_members dm
JOIN auth.users u ON u.id = dm.user_id;
