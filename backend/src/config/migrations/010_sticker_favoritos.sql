-- Stickers marcados como favoritos por cada agente.
-- Permite al picker mostrar una pestaña personal "★ Favoritos".

CREATE TABLE IF NOT EXISTS sticker_favoritos (
  id         SERIAL PRIMARY KEY,
  agente_id  INTEGER     NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  pack       VARCHAR(100) NOT NULL,
  file       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agente_id, pack, file)
);

CREATE INDEX IF NOT EXISTS idx_sticker_fav_agente ON sticker_favoritos(agente_id);
