-- Actualizar nombres visibles en la app: Willl y Anitaaa
-- Ejecutar en Supabase → SQL Editor si ya tenías la migración anterior.

UPDATE diary_members
SET display_name = 'Willl'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('wcahuayaquispe@gmail.com', 'wcahuayaquispe@gamil.com')
);

UPDATE diary_members
SET display_name = 'Anitaaa'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email = 'anabujaico6@gmail.com'
);
