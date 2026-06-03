-- Respuestas rápidas personalizadas por agente para el panel CRM.
CREATE TABLE IF NOT EXISTS respuestas_rapidas (
  id         SERIAL PRIMARY KEY,
  agente_id  INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  titulo     VARCHAR(100) NOT NULL,
  contenido  TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
