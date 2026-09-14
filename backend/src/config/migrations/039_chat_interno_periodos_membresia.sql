-- =============================================================================
-- 039 - Historial por Períodos de Membresía (Time-window Message Filtering)
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_interno_periodos_membresia (
  id SERIAL PRIMARY KEY,
  canal_id INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  salido_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cipm_canal_agente ON chat_interno_periodos_membresia(canal_id, agente_id);
CREATE INDEX IF NOT EXISTS idx_cipm_intervalo ON chat_interno_periodos_membresia(canal_id, agente_id, unido_en, salido_en);

-- Poblar períodos iniciales basados en chat_interno_miembros existentes
INSERT INTO chat_interno_periodos_membresia (canal_id, agente_id, unido_en, salido_en)
SELECT m.canal_id, m.agente_id, COALESCE(m.unido_en, NOW()), m.salido_en
FROM chat_interno_miembros m
WHERE NOT EXISTS (
  SELECT 1 FROM chat_interno_periodos_membresia p
  WHERE p.canal_id = m.canal_id AND p.agente_id = m.agente_id
);
