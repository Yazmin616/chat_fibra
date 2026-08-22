-- =============================================================================
-- 036 - Cierre de Canales y Ocultamiento Individual
-- =============================================================================

ALTER TABLE chat_interno_canales
ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS eliminado_por_id INT REFERENCES agentes(id) ON DELETE SET NULL;

ALTER TABLE chat_interno_miembros
ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cic_eliminado ON chat_interno_canales(eliminado);
CREATE INDEX IF NOT EXISTS idx_cim_oculto ON chat_interno_miembros(oculto);
