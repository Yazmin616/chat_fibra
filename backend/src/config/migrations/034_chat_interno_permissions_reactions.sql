-- =============================================================================
-- 034 - Permisos de canales y Reacciones Emoji (Chat Interno)
-- =============================================================================

-- 1. Agregar columna solo_lectura en chat_interno_canales
ALTER TABLE chat_interno_canales
ADD COLUMN IF NOT EXISTS solo_lectura BOOLEAN NOT NULL DEFAULT FALSE;

-- Marcar el canal #anuncios como solo lectura por defecto
UPDATE chat_interno_canales
SET solo_lectura = TRUE
WHERE nombre = 'anuncios' AND tipo = 'canal';

-- 2. Tabla de reacciones a mensajes
CREATE TABLE IF NOT EXISTS chat_interno_reacciones (
  id          SERIAL PRIMARY KEY,
  mensaje_id  INT NOT NULL REFERENCES chat_interno_mensajes(id) ON DELETE CASCADE,
  agente_id   INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  emoji       VARCHAR(20) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reaccion UNIQUE(mensaje_id, agente_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_cir_mensaje ON chat_interno_reacciones(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_cir_agente ON chat_interno_reacciones(agente_id);
