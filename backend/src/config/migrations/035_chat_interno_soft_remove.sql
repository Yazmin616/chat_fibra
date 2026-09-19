-- =============================================================================
-- 035 - Soft Remove y Retención de Historial para Miembros Removidos
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_interno_canales (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100),
  descripcion TEXT,
  tipo        VARCHAR(20) NOT NULL DEFAULT 'canal',
  creador_id  INT REFERENCES agentes(id) ON DELETE SET NULL,
  es_privado  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_interno_miembros (
  canal_id    INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id   INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  rol         VARCHAR(20) NOT NULL DEFAULT 'miembro',
  unido_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canal_id, agente_id)
);

CREATE TABLE IF NOT EXISTS chat_interno_mensajes (
  id             SERIAL PRIMARY KEY,
  canal_id       INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  emisor_id      INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  mensaje        TEXT,
  tipo           VARCHAR(20) NOT NULL DEFAULT 'texto',
  url_adjunto    TEXT,
  nombre_adjunto VARCHAR(255),
  tamano_adjunto INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_interno_leidos (
  canal_id                 INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id                INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  ultimo_mensaje_leido_id  INT NOT NULL DEFAULT 0,
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canal_id, agente_id)
);

ALTER TABLE chat_interno_miembros
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS salido_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removido_por_id INT REFERENCES agentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cim_activo ON chat_interno_miembros(activo);

