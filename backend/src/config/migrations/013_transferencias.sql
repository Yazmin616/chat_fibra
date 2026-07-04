-- Log de auditoría de transferencias de chat entre agentes/equipos
CREATE TABLE IF NOT EXISTS transferencias (
  id                   SERIAL PRIMARY KEY,
  conversacion_id      INT NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  empresa_id           VARCHAR(50) NOT NULL,
  agente_origen_id     INT NOT NULL,
  agente_origen_nombre VARCHAR(100) NOT NULL,
  area_origen          VARCHAR(100) NOT NULL,
  area_destino         VARCHAR(100) NOT NULL,
  tipo                 VARCHAR(20) NOT NULL CHECK (tipo IN ('mismo_equipo', 'entre_equipos')),
  nota                 TEXT NOT NULL,
  tomado_por_id        INT,
  tomado_por_nombre    VARCHAR(100),
  tomado_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transferencias_conversacion
  ON transferencias(conversacion_id);

CREATE INDEX IF NOT EXISTS idx_transferencias_empresa_fecha
  ON transferencias(empresa_id, created_at DESC);

-- Nota de contexto visible para el equipo/agente receptor
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS nota_transferencia TEXT;

-- Timestamp de la última transferencia entre equipos distintos
-- (se usa para filtrar el historial en el área destino — Caso 2)
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS transferida_en TIMESTAMPTZ;

-- Área de origen de la última transferencia entre equipos
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS transferida_desde VARCHAR(100);
