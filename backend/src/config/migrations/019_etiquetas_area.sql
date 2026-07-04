-- Agrega la dimensión de área a las etiquetas.
-- NULL = "General" (visible para todos los agentes de la empresa).
-- Valor con área específica = visible solo para esa área + admin.

ALTER TABLE etiquetas ADD COLUMN IF NOT EXISTS area VARCHAR(100) DEFAULT NULL;

-- Las etiquetas ya existentes quedan como NULL (General) — no quedan huérfanas.

CREATE INDEX IF NOT EXISTS idx_etiquetas_empresa_area ON etiquetas(empresa_id, area);
