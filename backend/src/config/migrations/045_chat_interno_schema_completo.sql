-- =============================================================================
-- 045 - Garantizar esquema completo de Chat Interno en produccion
-- =============================================================================

-- 1. Columnas completas en chat_interno_canales
ALTER TABLE chat_interno_canales
ADD COLUMN IF NOT EXISTS solo_lectura BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mensajes_temporales VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{"solo_admin_envia": false, "solo_admin_info": false}'::jsonb,
ADD COLUMN IF NOT EXISTS foto VARCHAR(255),
ADD COLUMN IF NOT EXISTS eliminado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS eliminado_por_id INT REFERENCES agentes(id) ON DELETE SET NULL;

-- 2. Columnas completas en chat_interno_miembros
ALTER TABLE chat_interno_miembros
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'miembro',
ADD COLUMN IF NOT EXISTS unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS salido_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS removido_por_id INT REFERENCES agentes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado_en TIMESTAMPTZ;

-- 3. Columnas completas en chat_interno_mensajes
ALTER TABLE chat_interno_mensajes
ADD COLUMN IF NOT EXISTS editado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fijado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado_por INT REFERENCES agentes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fijado_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS eliminado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado_hasta TIMESTAMPTZ;

-- 4. Tablas auxiliares
CREATE TABLE IF NOT EXISTS chat_interno_reacciones (
  id SERIAL PRIMARY KEY,
  mensaje_id INT NOT NULL REFERENCES chat_interno_mensajes(id) ON DELETE CASCADE,
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  emoji VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mensaje_id, agente_id)
);

CREATE TABLE IF NOT EXISTS chat_interno_leidos (
  canal_id INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  ultimo_mensaje_leido_id INT NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (canal_id, agente_id)
);

CREATE TABLE IF NOT EXISTS chat_interno_destacados (
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  mensaje_id INT NOT NULL REFERENCES chat_interno_mensajes(id) ON DELETE CASCADE,
  canal_id INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agente_id, mensaje_id)
);

CREATE TABLE IF NOT EXISTS chat_interno_periodos_membresia (
  id SERIAL PRIMARY KEY,
  canal_id INT NOT NULL REFERENCES chat_interno_canales(id) ON DELETE CASCADE,
  agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  salido_en TIMESTAMPTZ
);
