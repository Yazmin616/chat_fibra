-- Turnos por área (escalable)
-- area = NULL → turno global, se hereda por las áreas sin turno propio.
-- Los días van en formato "0,1,2,3,4,5,6" (Date.getDay(); 0=Dom).
CREATE TABLE IF NOT EXISTS turnos (
  id          SERIAL      PRIMARY KEY,
  empresa_id  TEXT        NOT NULL DEFAULT 'fibratec',
  area        TEXT,
  nombre      TEXT        NOT NULL,
  hora_inicio TEXT        NOT NULL,   -- "HH:MM"
  hora_fin    TEXT        NOT NULL,   -- "HH:MM"
  dias        TEXT        NOT NULL,   -- "1,2,3,4,5"
  activo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_empresa_area
  ON turnos(empresa_id, area);

-- Días festivos / no laborables.
-- area = NULL → aplica a todas las áreas de la empresa.
-- COALESCE en el índice único maneja NULL en area para la constraint.
CREATE TABLE IF NOT EXISTS festivos (
  id          SERIAL      PRIMARY KEY,
  empresa_id  TEXT        NOT NULL DEFAULT 'fibratec',
  fecha       DATE        NOT NULL,
  nombre      TEXT,
  area        TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_festivos_unique
  ON festivos(empresa_id, fecha, COALESCE(area, ''));

CREATE INDEX IF NOT EXISTS idx_festivos_empresa_fecha
  ON festivos(empresa_id, fecha);

-- Columna de deduplicación: evita re-enviar el aviso de horario en la misma conversación.
-- Se resetea al crear una nueva conversación (DEFAULT false).
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS aviso_horario_enviado BOOLEAN NOT NULL DEFAULT false;

-- Mensajes automáticos A y B (defaults conservadores; el admin los edita).
-- ON CONFLICT DO NOTHING para no pisar configs ya personalizadas.
INSERT INTO configuraciones (clave, valor, empresa_id) VALUES
  ('msg_festivo',
   '¡Hola! 👋 Hoy es día festivo en {empresa}. El equipo de {area} retoma actividades el {proximo_dia_habil}. Disculpa el inconveniente — escríbenos entonces y te atenderemos con gusto.\n\n🕐 Horarios habituales:\n{horarios_atencion}',
   'fibratec'),
  ('msg_fuera_horario',
   '¡Hola! 👋 Gracias por contactar a {empresa}. En este momento el equipo de {area} no está disponible.\n\n🕐 Horarios de atención:\n{horarios_atencion}\n\nTu mensaje quedó registrado y te responderemos en cuanto retomemos actividades. ¡Hasta pronto!',
   'fibratec')
ON CONFLICT (clave, empresa_id) DO NOTHING;
