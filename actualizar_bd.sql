-- =============================================================================
-- Script de actualización integral de Base de Datos para Chat Fibra
-- Incluye: Chat Interno, Presencia de Agentes, y Tickets de Soporte TI
-- =============================================================================

-- Control de migraciones
CREATE TABLE IF NOT EXISTS migrations (
  id         SERIAL PRIMARY KEY,
  filename   VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Canales de Chat Interno
CREATE TABLE IF NOT EXISTS chat_interno_canales (
  id                SERIAL PRIMARY KEY,
  nombre            VARCHAR(100),
  descripcion       TEXT,
  tipo              VARCHAR(20) NOT NULL DEFAULT 'canal',
  creador_id        INT REFERENCES agentes(id) ON DELETE SET NULL,
  es_privado        BOOLEAN NOT NULL DEFAULT FALSE,
  solo_lectura      BOOLEAN NOT NULL DEFAULT FALSE,
  eliminado         BOOLEAN NOT NULL DEFAULT FALSE,
  eliminado_en      TIMESTAMPTZ,
  eliminado_por_id  INT REFERENCES agentes(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_interno_canales ADD COLUMN IF NOT EXISTS solo_lectura BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_interno_canales ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_interno_canales ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
ALTER TABLE chat_interno_canales ADD COLUMN IF NOT EXISTS eliminado_por_id INT REFERENCES agentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cic_tipo ON chat_interno_canales(tipo);
CREATE INDEX IF NOT EXISTS idx_cic_eliminado ON chat_interno_canales(eliminado);

-- 2. Miembros de Canales
CREATE TABLE IF NOT EXISTS chat_interno_miembros (
  canal_id          INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id         INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  rol               VARCHAR(20) NOT NULL DEFAULT 'miembro',
  unido_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  salido_en         TIMESTAMPTZ,
  removido_por_id   INT REFERENCES agentes(id) ON DELETE SET NULL,
  oculto            BOOLEAN NOT NULL DEFAULT FALSE,
  fijado            BOOLEAN NOT NULL DEFAULT FALSE,
  fijado_en         TIMESTAMPTZ,
  PRIMARY KEY (canal_id, agente_id)
);

ALTER TABLE chat_interno_miembros ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE chat_interno_miembros ADD COLUMN IF NOT EXISTS salido_en TIMESTAMPTZ;
ALTER TABLE chat_interno_miembros ADD COLUMN IF NOT EXISTS removido_por_id INT REFERENCES agentes(id) ON DELETE SET NULL;
ALTER TABLE chat_interno_miembros ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_interno_miembros ADD COLUMN IF NOT EXISTS fijado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_interno_miembros ADD COLUMN IF NOT EXISTS fijado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cim_agente ON chat_interno_miembros(agente_id);
CREATE INDEX IF NOT EXISTS idx_cim_canal ON chat_interno_miembros(canal_id);
CREATE INDEX IF NOT EXISTS idx_cim_activo ON chat_interno_miembros(activo);
CREATE INDEX IF NOT EXISTS idx_cim_oculto ON chat_interno_miembros(oculto);
CREATE INDEX IF NOT EXISTS idx_cim_fijado ON chat_interno_miembros(fijado);

-- 3. Mensajes de Chat Interno
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

CREATE INDEX IF NOT EXISTS idx_cims_canal ON chat_interno_mensajes(canal_id);
CREATE INDEX IF NOT EXISTS idx_cims_created ON chat_interno_mensajes(created_at);

-- 4. Control de Lectura
CREATE TABLE IF NOT EXISTS chat_interno_leidos (
  canal_id                 INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id                INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  ultimo_mensaje_leido_id  INT NOT NULL DEFAULT 0,
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canal_id, agente_id)
);

CREATE INDEX IF NOT EXISTS idx_cil_agente ON chat_interno_leidos(agente_id);

-- 5. Reacciones a Mensajes
CREATE TABLE IF NOT EXISTS chat_interno_reacciones (
  id          SERIAL PRIMARY KEY,
  mensaje_id  INT NOT NULL REFERENCES chat_interno_mensajes(id) ON DELETE CASCADE,
  agente_id   INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  emoji       VARCHAR(20) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reaccion UNIQUE(mensaje_id, agente_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_cir_mensaje ON chat_interno_reacciones(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_cir_agente ON chat_interno_reacciones(agente_id);

-- 6. Periodos de Membresía
CREATE TABLE IF NOT EXISTS chat_interno_periodos_membresia (
  id SERIAL PRIMARY KEY,
  canal_id INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  salido_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cipm_canal_agente ON chat_interno_periodos_membresia(canal_id, agente_id);
CREATE INDEX IF NOT EXISTS idx_cipm_intervalo ON chat_interno_periodos_membresia(canal_id, agente_id, unido_en, salido_en);

INSERT INTO chat_interno_periodos_membresia (canal_id, agente_id, unido_en, salido_en)
SELECT m.canal_id, m.agente_id, COALESCE(m.unido_en, NOW()), m.salido_en
FROM chat_interno_miembros m
WHERE NOT EXISTS (
  SELECT 1 FROM chat_interno_periodos_membresia p
  WHERE p.canal_id = m.canal_id AND p.agente_id = m.agente_id
);

-- 7. Estado de Presencia y Campos de Usuario en Agentes
ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS usuario VARCHAR(60) UNIQUE,
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coordinador_id INTEGER REFERENCES agentes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS puede_recuperar_auto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS estado_presencia VARCHAR(50) DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS mensaje_presencia VARCHAR(255) DEFAULT NULL;

ALTER TABLE agentes ALTER COLUMN email DROP NOT NULL;

UPDATE agentes
SET usuario = CASE
  WHEN email = 'admin@fibratec.mx' THEN 'admin'
  WHEN email = 'tu_email@ejemplo.com' THEN 'tiadmin'
  WHEN email = 'soporte@fibratec.mx' THEN 'soporte'
  WHEN email = 'ventas@fibratec.mx' THEN 'ventas'
  WHEN email = 'cobranza@fibratec.mx' THEN 'cobranza'
  WHEN email = 'soporte2@fibratec.mx' THEN 'soporte2'
  WHEN email = 'ventas2@fibratec.mx' THEN 'ventas2'
  WHEN email = 'cobranza2@fibratec.mx' THEN 'cobranza2'
  WHEN email = 'desarrollo@fibratec.mx' THEN 'desarrollo'
  WHEN email LIKE 'rh%@%' THEN 'rh'
  ELSE LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(email, nombre), '@', 1), '[^a-zA-Z0-9_.]', '', 'g'))
END
WHERE usuario IS NULL;

CREATE INDEX IF NOT EXISTS idx_agentes_usuario ON agentes (LOWER(usuario));
CREATE INDEX IF NOT EXISTS idx_agentes_coordinador ON agentes (coordinador_id);

DO $$
BEGIN
  IF to_regclass('areas_soluciones') IS NOT NULL THEN
    ALTER TABLE areas_soluciones ADD COLUMN IF NOT EXISTS coordinador_id INTEGER REFERENCES agentes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. Tickets de Soporte TI
CREATE SEQUENCE IF NOT EXISTS tickets_ti_folio_seq START 1;

CREATE TABLE IF NOT EXISTS tickets_ti (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(30) UNIQUE NOT NULL DEFAULT ('TK-' || LPAD(nextval('tickets_ti_folio_seq'::regclass)::TEXT, 4, '0')),
    titulo VARCHAR(250) NOT NULL,
    descripcion TEXT NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'error',
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
    estado VARCHAR(30) NOT NULL DEFAULT 'abierto',
    solicitante_id INT REFERENCES agentes(id) ON DELETE SET NULL,
    solicitante_nombre VARCHAR(150),
    asignado_id INT REFERENCES agentes(id) ON DELETE SET NULL,
    notas_resolucion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_ti_estado ON tickets_ti(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_tipo ON tickets_ti(tipo);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_prioridad ON tickets_ti(prioridad);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_created_at ON tickets_ti(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_asignado_id ON tickets_ti(asignado_id);

CREATE TABLE IF NOT EXISTS ticket_ti_comentarios (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets_ti(id) ON DELETE CASCADE,
    agente_id INT REFERENCES agentes(id) ON DELETE SET NULL,
    comentario TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_ti_comentarios_ticket_id ON ticket_ti_comentarios(ticket_id);

-- 9. Canales y Módulos por Defecto
DO $$
DECLARE
  v_general_id INT;
  v_anuncios_id INT;
  v_soporte_id INT;
BEGIN
  IF to_regclass('modulos') IS NOT NULL THEN
    INSERT INTO modulos(id, nombre, descripcion) VALUES
      ('comunicados',   'Avisos y Mural',          'Mural corporativo de avisos, efemérides y cumpleaños'),
      ('chat_interno',  'Chat Interno',            'Mensajería interna corporativa entre colaboradores'),
      ('chat',          'Chat Clientes',           'Panel de conversaciones y atención al cliente'),
      ('contactos',     'Contactos',               'Directorio de clientes'),
      ('infracciones',  'Infracciones',            'Registro de infracciones del equipo'),
      ('dashboard',     'Dashboard',               'Analíticas y métricas del sistema'),
      ('nps',           'Dashboard de Staff',      'Métricas de rendimiento y NPS del staff'),
      ('soluciones',    'Soluciones Staff',        'Historial de cierres y soluciones del staff'),
      ('usuarios',      'Usuarios',                'Gestión de agentes y cuentas'),
      ('configuracion', 'Configuración',           'Parámetros globales: jornadas, SLA, etc.'),
      ('etiquetas',     'Etiquetas',               'Catálogo de etiquetas para conversaciones'),
      ('notas_cierre',  'Notas de Cierre',         'Categorías de cierre de conversaciones'),
      ('equipos',       'Equipos',                 'Gestión de equipos y coordinadores de área'),
      ('tickets',       'Tickets / Soporte TI',    'Levantar y consultar solicitudes de soporte y tareas TI'),
      ('flujos',        'Flujos de Bot',           'Diseño y configuración de flujos automáticos del bot')
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion;
  END IF;

  IF to_regclass('usuario_modulos') IS NOT NULL THEN
    INSERT INTO usuario_modulos(usuario_id, modulo)
      SELECT id, 'chat_interno' FROM agentes WHERE rol IN ('admin', 'asesor', 'ti')
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM chat_interno_canales WHERE nombre = 'general' AND tipo = 'canal') THEN
    INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado)
    VALUES ('general', 'Canal general de la empresa para toda la organizacion', 'canal', FALSE)
    RETURNING id INTO v_general_id;

    INSERT INTO chat_interno_miembros(canal_id, agente_id, rol)
    SELECT v_general_id, id, 'miembro' FROM agentes
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM chat_interno_canales WHERE nombre = 'anuncios' AND tipo = 'canal') THEN
    INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado, solo_lectura)
    VALUES ('anuncios', 'Anuncios y comunicados oficiales de la direccion', 'canal', FALSE, TRUE)
    RETURNING id INTO v_anuncios_id;

    INSERT INTO chat_interno_miembros(canal_id, agente_id, rol)
    SELECT v_anuncios_id, id, 'miembro' FROM agentes
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM chat_interno_canales WHERE nombre = 'soporte-interno' AND tipo = 'canal') THEN
    INSERT INTO chat_interno_canales(nombre, descripcion, tipo, es_privado)
    VALUES ('soporte-interno', 'Canal de coordinacion tecnica y resolucion interna', 'canal', FALSE)
    RETURNING id INTO v_soporte_id;

    INSERT INTO chat_interno_miembros(canal_id, agente_id, rol)
    SELECT v_soporte_id, id, 'miembro' FROM agentes
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 10. Registrar Migraciones
INSERT INTO migrations (filename) VALUES
  ('033_chat_interno.sql'),
  ('034_chat_interno_permissions_reactions.sql'),
  ('035_chat_interno_soft_remove.sql'),
  ('036_chat_interno_channel_archive_and_hide.sql'),
  ('037_agentes_presencia_estado.sql'),
  ('038_chat_interno_pin_chats.sql'),
  ('039_chat_interno_periodos_membresia.sql'),
  ('040_tickets_ti.sql'),
  ('041_auth_coordinadores_usuario.sql'),
  ('042_catalogo_modulos_completo.sql')
ON CONFLICT (filename) DO NOTHING;
