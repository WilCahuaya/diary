-- Paleta Calidez Neutra: menta (dueña) y lavanda (invitada)
UPDATE diary_members SET color = '#4D7563' WHERE is_owner = true;
UPDATE diary_members SET color = '#7A6A98' WHERE is_owner = false;
