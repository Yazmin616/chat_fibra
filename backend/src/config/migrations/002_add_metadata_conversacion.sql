-- Migración 002: columna metadata en conversaciones
-- Almacena datos temporales del flujo del bot: datos del cliente WISP (mock),
-- servicio seleccionado e intentos de identificación fallidos.
-- Se usa JSONB con merge parcial (operador ||) para actualizaciones atómicas.

BEGIN;

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_conversaciones_metadata
  ON conversaciones USING GIN (metadata);

COMMIT;
