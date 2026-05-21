-- Migración 001: columna `estado` en mensajes
-- Reemplaza el boolean `leido` (que confundía "entregado" y "leido") con un
-- campo explícito de tres estados para mensajes de agente/bot.
--
-- Estados posibles:
--   enviado    → guardado en BD, aún no confirmado por el canal externo
--   entregado  → el canal externo (Telegram, Meta, etc.) aceptó el mensaje
--   leido      → inferido: el cliente respondió (Telegram) o confirmó lectura (Meta)
--
-- El campo `leido` (boolean) se conserva SOLO para mensajes de remitente='user',
-- donde sigue siendo el mecanismo de conteo del badge de no-leídos en la bandeja.

BEGIN;

-- 1. Agregar columna con valor por defecto 'enviado'
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'enviado';

-- 2. Migrar datos existentes de agente/bot:
--    leido=true → 'leido' (asignamos el estado más avanzado posible; no hay forma de
--    distinguir históricamente entre entregado y leido con solo un boolean)
UPDATE mensajes
  SET estado = 'leido'
  WHERE remitente IN ('agente', 'bot') AND leido = true;

-- 3. Índice para lecturas por estado (útil para filtros futuros)
CREATE INDEX IF NOT EXISTS idx_mensajes_estado ON mensajes(conversacion_id, estado);

COMMIT;
