-- Tabla de infracciones: registra incumplimientos de SLA por área o por agente.
CREATE TABLE IF NOT EXISTS infracciones (
  id              SERIAL PRIMARY KEY,
  conversacion_id INT REFERENCES conversaciones(id) ON DELETE CASCADE,
  empresa_id      VARCHAR NOT NULL,
  departamento    VARCHAR,
  cliente_nombre  VARCHAR,
  tiempo_espera   INT NOT NULL,
  tipo            VARCHAR NOT NULL DEFAULT 'area',
  agente_id       INT REFERENCES agentes(id) ON DELETE SET NULL,
  agente_nombre   VARCHAR,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Columnas agregadas en versiones posteriores (idempotente si ya existen)
ALTER TABLE infracciones ADD COLUMN IF NOT EXISTS tipo          VARCHAR NOT NULL DEFAULT 'area';
ALTER TABLE infracciones ADD COLUMN IF NOT EXISTS agente_id     INT REFERENCES agentes(id) ON DELETE SET NULL;
ALTER TABLE infracciones ADD COLUMN IF NOT EXISTS agente_nombre VARCHAR;
