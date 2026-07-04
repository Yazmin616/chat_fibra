-- Migración 014: media adjunta en respuestas rápidas
-- Permite asociar una imagen o documento a cada respuesta rápida personal.
ALTER TABLE respuestas_rapidas
  ADD COLUMN IF NOT EXISTS url_media     TEXT,
  ADD COLUMN IF NOT EXISTS tipo_media    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);
