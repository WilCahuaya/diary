-- Registrar las dos integrantes del diario por correo electrónico
-- Ejecutar DESPUÉS de 003_shared_diary.sql y de crear ambas usuarias en Authentication

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

-- Verificar:
-- SELECT dm.display_name, dm.color, dm.is_owner, u.email
-- FROM diary_members dm JOIN auth.users u ON u.id = dm.user_id;
