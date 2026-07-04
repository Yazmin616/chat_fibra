-- ═══════════════════════════════════════════════════════════════
-- 023 · Sistema de permisos por usuario (empresas · áreas · módulos)
-- ═══════════════════════════════════════════════════════════════

-- ── Catálogo de módulos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modulos (
  id          VARCHAR(50) PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT
);

INSERT INTO modulos(id, nombre, descripcion) VALUES
  ('chat',          'Chat',           'Panel de conversaciones y atención al cliente'),
  ('contactos',     'Contactos',      'Directorio de clientes'),
  ('infracciones',  'Infracciones',   'Registro y consulta de infracciones del equipo'),
  ('dashboard',     'Dashboard',      'Analíticas y métricas del sistema'),
  ('usuarios',      'Usuarios',       'Gestión de agentes y cuentas del sistema'),
  ('configuracion', 'Configuración',  'Parámetros globales: jornadas, SLA, etc.'),
  ('etiquetas',     'Etiquetas',      'Catálogo de etiquetas para conversaciones'),
  ('notas_cierre',  'Notas de Cierre','Categorías de cierre de conversaciones')
ON CONFLICT (id) DO NOTHING;

-- ── Empresas asignadas a cada usuario ────────────────────────────────────────
-- empresa_id = '__todas__' → acceso a todas las empresas
CREATE TABLE IF NOT EXISTS usuario_empresas (
  usuario_id INT         NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  empresa_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (usuario_id, empresa_id)
);

-- ── Áreas asignadas a cada usuario (dentro de sus empresas) ──────────────────
-- empresa_id = '__todas__', area = '__todas__' → todas las áreas de todas las empresas
-- empresa_id = 'fibratec',  area = '__todas__' → todas las áreas de fibratec
CREATE TABLE IF NOT EXISTS usuario_areas (
  usuario_id INT          NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  empresa_id VARCHAR(50)  NOT NULL,
  area       VARCHAR(100) NOT NULL,
  PRIMARY KEY (usuario_id, empresa_id, area)
);

-- ── Módulos accesibles por cada usuario ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuario_modulos (
  usuario_id INT         NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  modulo     VARCHAR(50) NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, modulo)
);

-- ── Auditoría de cambios de permisos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permiso_log (
  id         SERIAL PRIMARY KEY,
  admin_id   INT          NOT NULL REFERENCES agentes(id),
  usuario_id INT          NOT NULL REFERENCES agentes(id),
  payload    JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ue_usuario ON usuario_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ua_usuario ON usuario_areas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_um_usuario ON usuario_modulos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pl_usuario ON permiso_log(usuario_id);

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN DE DATOS: permisos por defecto según rol actual
-- ═══════════════════════════════════════════════════════════════

-- Admin → acceso total
INSERT INTO usuario_empresas(usuario_id, empresa_id)
  SELECT id, '__todas__' FROM agentes WHERE rol = 'admin'
  ON CONFLICT DO NOTHING;

INSERT INTO usuario_areas(usuario_id, empresa_id, area)
  SELECT id, '__todas__', '__todas__' FROM agentes WHERE rol = 'admin'
  ON CONFLICT DO NOTHING;

INSERT INTO usuario_modulos(usuario_id, modulo)
  SELECT a.id, m.id FROM agentes a CROSS JOIN modulos m WHERE a.rol = 'admin'
  ON CONFLICT DO NOTHING;

-- Asesor → todas las empresas/áreas, módulos operativos
INSERT INTO usuario_empresas(usuario_id, empresa_id)
  SELECT id, '__todas__' FROM agentes WHERE rol = 'asesor'
  ON CONFLICT DO NOTHING;

INSERT INTO usuario_areas(usuario_id, empresa_id, area)
  SELECT id, '__todas__', '__todas__' FROM agentes WHERE rol = 'asesor'
  ON CONFLICT DO NOTHING;

INSERT INTO usuario_modulos(usuario_id, modulo)
  SELECT a.id, m.modulo
  FROM agentes a
  CROSS JOIN (VALUES ('chat'),('contactos'),('etiquetas'),('notas_cierre')) AS m(modulo)
  WHERE a.rol = 'asesor'
  ON CONFLICT DO NOTHING;

-- TI → todas las empresas/áreas, módulos TI
INSERT INTO usuario_empresas(usuario_id, empresa_id)
  SELECT id, '__todas__' FROM agentes WHERE rol = 'ti'
  ON CONFLICT DO NOTHING;

INSERT INTO usuario_areas(usuario_id, empresa_id, area)
  SELECT id, '__todas__', '__todas__' FROM agentes WHERE rol = 'ti'
  ON CONFLICT DO NOTHING;

INSERT INTO usuario_modulos(usuario_id, modulo)
  SELECT a.id, m.modulo
  FROM agentes a
  CROSS JOIN (VALUES ('chat'),('infracciones'),('contactos'),('dashboard')) AS m(modulo)
  WHERE a.rol = 'ti'
  ON CONFLICT DO NOTHING;
