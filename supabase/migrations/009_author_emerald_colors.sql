-- Colores de autoras alineados con el tema esmeralda
UPDATE diary_members SET color = '#047857' WHERE is_owner = true;
UPDATE diary_members SET color = '#059669' WHERE is_owner = false;
