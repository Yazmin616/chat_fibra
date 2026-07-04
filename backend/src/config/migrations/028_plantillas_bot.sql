CREATE TABLE IF NOT EXISTS plantillas_bot (
  id SERIAL PRIMARY KEY,
  empresa_id VARCHAR(50) NOT NULL,
  clave VARCHAR(100) NOT NULL,
  texto TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_plantillas_bot_empresa ON plantillas_bot(empresa_id);
