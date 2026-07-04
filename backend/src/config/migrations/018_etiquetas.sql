-- Catálogo de etiquetas por empresa
CREATE TABLE IF NOT EXISTS etiquetas (
  id          SERIAL PRIMARY KEY,
  empresa_id  VARCHAR(50) NOT NULL DEFAULT 'fibratec',
  nombre      VARCHAR(80) NOT NULL,
  descripcion TEXT,
  color       VARCHAR(7)  NOT NULL DEFAULT '#3b82f6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_etiquetas_empresa ON etiquetas(empresa_id);

-- Relación N:M entre conversaciones y etiquetas
CREATE TABLE IF NOT EXISTS conversacion_etiquetas (
  conversacion_id INT NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  etiqueta_id     INT NOT NULL REFERENCES etiquetas(id)      ON DELETE CASCADE,
  asignada_por    INT REFERENCES agentes(id) ON DELETE SET NULL,
  asignada_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversacion_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_etiquetas_conv     ON conversacion_etiquetas(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_conv_etiquetas_etiqueta ON conversacion_etiquetas(etiqueta_id);
