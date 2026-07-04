-- Migración 017: ampliar valor en configuraciones de VARCHAR(255) a TEXT
-- Necesario para almacenar mensajes largos (mantenimiento, fuera de horario, etc.)
ALTER TABLE configuraciones ALTER COLUMN valor TYPE TEXT;
