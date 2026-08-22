-- =============================================================================
-- 033 - Módulo de Chat Interno Corporativo
-- =============================================================================

-- 1. Registrar el módulo 'chat_interno' en el catálogo de módulos
INSERT INTO modulos(id, nombre, descripcion) VALUES
  ('chat_interno', 'Chat Interno', 'Mensajería interna corporativa entre colaboradores')
ON CONFLICT (id) DO NOTHING;

-- Asignar el módulo 'chat_interno' a administradores y asesores por defecto
INSERT INTO usuario_modulos(usuario_id, modulo)
  SELECT id, 'chat_interno' FROM agentes WHERE rol IN ('admin', 'asesor', 'ti')
ON CONFLICT DO NOTHING;

-- 2. Tabla de canales (grupales o directos)
CREATE TABLE IF NOT EXISTS chat_interno_canales (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100), -- Nombre del canal (ej: 'general', 'soporte'). NULL en chats directos 1 a 1.
  descripcion TEXT,
  tipo        VARCHAR(20) NOT NULL DEFAULT 'canal', -- 'canal' (grupal) o 'directo' (1 a 1)
  creador_id  INT REFERENCES agentes(id) ON DELETE SET NULL,
  es_privado  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Miembros de cada canal
CREATE TABLE IF NOT EXISTS chat_interno_miembros (
  canal_id    INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id   INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  rol         VARCHAR(20) NOT NULL DEFAULT 'miembro', -- 'admin', 'miembro'
  unido_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canal_id, agente_id)
);

-- 4. Mensajes del chat interno
CREATE TABLE IF NOT EXISTS chat_interno_mensajes (
  id             SERIAL PRIMARY KEY,
  canal_id       INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  emisor_id      INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  mensaje        TEXT,
  tipo           VARCHAR(20) NOT NULL DEFAULT 'texto', -- 'texto', 'imagen', 'archivo'
  url_adjunto    TEXT,
  nombre_adjunto VARCHAR(255),
  tamano_adjunto INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Control de lectura por canal y agente
CREATE TABLE IF NOT EXISTS chat_interno_leidos (
  canal_id                 INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id                INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  ultimo_mensaje_leido_id  INT NOT NULL DEFAULT 0,
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canal_id, agente_id)
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_cic_tipo ON chat_interno_canales(tipo);
CREATE INDEX IF NOT EXISTS idx_cim_agente ON chat_interno_miembros(agente_id);
CREATE INDEX IF NOT EXISTS idx_cim_canal ON chat_interno_miembros(canal_id);
CREATE INDEX IF NOT EXISTS idx_cims_canal ON chat_interno_mensajes(canal_id);
CREATE INDEX IF NOT EXISTS idx_cims_created ON chat_interno_mensajes(created_at);
CREATE INDEX IF NOT EXISTS idx_cil_agente ON chat_interno_leidos(agente_id);

-- Sembrar canales corporativos públicos iniciales
DO $$
DECLARE
  v_general_id INT;
  v_anuncios_id INT;
  v_soporte_id INT;
BEGIN
  -- Canal #general
  IF NOT EXISTS (SELECT 1 FROM chat_interno_canales WHERE nombre = 'general' AND tipo = 'canal') THEN
    INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado)
    VALUES ('general', 'Canal general de la empresa para toda la organización', 'canal', FALSE)
    RETURNING id INTO v_general_id;

    INSERT INTO chat_interno_miembros(canal_id, agente_id, rol)
    SELECT v_general_id, id, 'miembro' FROM agentes
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canal #anuncios
  IF NOT EXISTS (SELECT 1 FROM chat_interno_canales WHERE nombre = 'anuncios' AND tipo = 'canal') THEN
    INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado)
    VALUES ('anuncios', 'Anuncios y comunicados oficiales de la dirección', 'canal', FALSE)
    RETURNING id INTO v_anuncios_id;

    INSERT INTO chat_interno_miembros(canal_id, agente_id, rol)
    SELECT v_anuncios_id, id, 'miembro' FROM agentes
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canal #soporte-interno
  IF NOT EXISTS (SELECT 1 FROM chat_interno_canales WHERE nombre = 'soporte-interno' AND tipo = 'canal') THEN
    INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado)
    VALUES ('soporte-interno', 'Canal de coordinación técnica y resolución interna', 'canal', FALSE)
    RETURNING id INTO v_soporte_id;

    INSERT INTO chat_interno_miembros(canal_id, agente_id, rol)
    SELECT v_soporte_id, id, 'miembro' FROM agentes
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
