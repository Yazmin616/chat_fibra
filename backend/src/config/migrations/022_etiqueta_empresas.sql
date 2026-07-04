-- ============================================================
-- Migración 022: M:M empresa↔etiquetas y empresa↔categoria_cierre
-- '__todas__' = visible para todas las empresas del sistema
-- ============================================================

-- ── Tablas de asignación de empresas ──────────────────────

CREATE TABLE IF NOT EXISTS etiqueta_empresas (
  etiqueta_id INT NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  empresa_id  VARCHAR(50) NOT NULL,
  PRIMARY KEY (etiqueta_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_etq_emp_empresa ON etiqueta_empresas(empresa_id);

CREATE TABLE IF NOT EXISTS cat_cierre_empresas (
  cat_cierre_id INT NOT NULL REFERENCES categoria_cierre(id) ON DELETE CASCADE,
  empresa_id    VARCHAR(50) NOT NULL,
  PRIMARY KEY (cat_cierre_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_cat_emp_empresa ON cat_cierre_empresas(empresa_id);

-- ── Migración de datos: preservar asignaciones existentes ─

INSERT INTO etiqueta_empresas (etiqueta_id, empresa_id)
SELECT id, empresa_id FROM etiquetas
ON CONFLICT DO NOTHING;

INSERT INTO cat_cierre_empresas (cat_cierre_id, empresa_id)
SELECT id, empresa_id FROM categoria_cierre
ON CONFLICT DO NOTHING;
