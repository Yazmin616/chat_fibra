-- Migración 015: agente_id en mensajes para identificar quién envió cada mensaje
ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS agente_id INT REFERENCES agentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mensajes_agente_id ON mensajes(agente_id);
