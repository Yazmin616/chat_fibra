-- =============================================================================
-- 035 - Soft Remove y Retención de Historial para Miembros Removidos
-- =============================================================================

ALTER TABLE chat_interno_miembros
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS salido_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removido_por_id INT REFERENCES agentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cim_activo ON chat_interno_miembros(activo);
