-- ============================================================
-- Migración 020: Categorías de cierre + campos KPI en conversaciones
-- ============================================================

-- ── Catálogo de categorías de cierre ─────────────────────
CREATE TABLE IF NOT EXISTS categoria_cierre (
  id         SERIAL PRIMARY KEY,
  empresa_id VARCHAR(50)  NOT NULL DEFAULT 'fibratec',
  nombre     VARCHAR(100) NOT NULL,
  descripcion TEXT,
  area       VARCHAR(100) DEFAULT NULL,   -- NULL = General (visible en todas las áreas)
  activa     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_cat_cierre_empresa_area ON categoria_cierre(empresa_id, area);

-- Categorías iniciales para no empezar en blanco
INSERT INTO categoria_cierre (empresa_id, nombre, area) VALUES
  ('fibratec',    'Problema resuelto',                NULL),
  ('fibratec',    'Sin solución disponible',          NULL),
  ('fibratec',    'Cliente desistió',                 NULL),
  ('fibratec',    'Derivado a otro área',             NULL),
  ('fibratec',    'Falla de servicio resuelta',       'Soporte Técnico'),
  ('fibratec',    'Gestión de cobro completada',      'Cobranza'),
  ('fibratec',    'Venta concretada',                 'Ventas'),
  ('fibratec',    'Venta no concretada',              'Ventas'),
  ('compusemmm',  'Problema resuelto',                NULL),
  ('compusemmm',  'Sin solución disponible',          NULL),
  ('compusemmm',  'Cliente desistió',                 NULL)
ON CONFLICT DO NOTHING;

-- ── Nuevas columnas KPI en conversaciones ────────────────
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS categoria_cierre_id INT     REFERENCES categoria_cierre(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comentario_cierre   TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cierre         VARCHAR(20) DEFAULT NULL,   -- 'manual' | 'automatico' | 'legacy'
  ADD COLUMN IF NOT EXISTS cerrado_por_id      INT     REFERENCES agentes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cerrado_en          TIMESTAMPTZ;

-- Marcar cierres anteriores como 'legacy' para no mezclar con los nuevos
UPDATE conversaciones
  SET tipo_cierre = 'legacy',
      cerrado_en  = updated_at
  WHERE estado IN ('ENCUESTA_AGENTE', 'ENCUESTA_BOT', 'cerrada')
    AND tipo_cierre IS NULL;

-- Índices para consultas KPI
CREATE INDEX IF NOT EXISTS idx_conv_tipo_cierre         ON conversaciones(tipo_cierre);
CREATE INDEX IF NOT EXISTS idx_conv_cerrado_por_id      ON conversaciones(cerrado_por_id);
CREATE INDEX IF NOT EXISTS idx_conv_categoria_cierre_id ON conversaciones(categoria_cierre_id);
CREATE INDEX IF NOT EXISTS idx_conv_cerrado_en          ON conversaciones(cerrado_en);
