-- Flujos visuales del bot — uno por empresa.
-- nodos y conexiones almacenan el JSON del diagrama React Flow + datos de ejecución.
CREATE TABLE IF NOT EXISTS flujos_bot (
  id          SERIAL PRIMARY KEY,
  empresa_id  VARCHAR(100) NOT NULL,
  nombre      VARCHAR(100) NOT NULL DEFAULT 'Flujo principal',
  nodos       JSONB        NOT NULL DEFAULT '[]',
  conexiones  JSONB        NOT NULL DEFAULT '[]',
  root_node   VARCHAR(100) NOT NULL DEFAULT 'entrada',
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  version     INTEGER      NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ  DEFAULT NOW(),
  CONSTRAINT flujos_bot_empresa_nombre UNIQUE (empresa_id, nombre)
);
