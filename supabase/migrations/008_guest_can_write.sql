-- Permiso de escritura para la otra integrante (controlado por la dueña)
ALTER TABLE diary_members
ADD COLUMN IF NOT EXISTS guest_can_write BOOLEAN NOT NULL DEFAULT true;

UPDATE diary_members
SET guest_can_write = true
WHERE is_owner = true AND guest_can_write IS DISTINCT FROM true;
