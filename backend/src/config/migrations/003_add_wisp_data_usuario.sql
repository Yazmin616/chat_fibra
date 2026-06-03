-- Migración 003: columna wisp_data en usuarios
-- Persiste los datos del cliente WISP (servicios, nombre) identificado en sesiones previas.
-- Permite reconocer al cliente automáticamente en futuras conversaciones
-- sin pedirle que se identifique de nuevo.

BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS wisp_data JSONB;

COMMIT;
