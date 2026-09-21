-- =============================================================================
-- 044 - Columnas complementarias de Chat Interno (foto de canal y destacados)
-- =============================================================================

-- 1. Columna foto en chat_interno_canales
ALTER TABLE chat_interno_canales
ADD COLUMN IF NOT EXISTS foto VARCHAR(255);

-- 2. Columnas complementarias en chat_interno_mensajes
ALTER TABLE chat_interno_mensajes
ADD COLUMN IF NOT EXISTS editado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fijado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado_por INT REFERENCES agentes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fijado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS eliminado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado_hasta TIMESTAMPTZ;

-- 3. Tabla chat_interno_destacados si no existe
CREATE TABLE IF NOT EXISTS chat_interno_destacados (
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  mensaje_id INT NOT NULL REFERENCES chat_interno_mensajes(id) ON DELETE CASCADE,
  canal_id INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agente_id, mensaje_id)
);

CREATE INDEX IF NOT EXISTS idx_cid_agente ON chat_interno_destacados(agente_id);
CREATE INDEX IF NOT EXISTS idx_cid_canal ON chat_interno_destacados(canal_id);
