-- 024_rol_permisos_template.sql
-- Plantillas de permisos por defecto según el rol.
-- Al crear un agente nuevo, se copian los permisos de su rol.
-- El admin puede editar estas plantillas sin tocar código.

CREATE TABLE IF NOT EXISTS rol_permisos_template (
  rol        VARCHAR(50) PRIMARY KEY,
  empresas   JSONB NOT NULL DEFAULT '["__todas__"]',
  areas      JSONB NOT NULL DEFAULT '[{"empresa_id":"__todas__","areas":["__todas__"]}]',
  modulos    JSONB NOT NULL DEFAULT '[]',
  updated_by INT  REFERENCES agentes(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plantillas por defecto coherentes con los permisos asignados en migración 023
INSERT INTO rol_permisos_template(rol, empresas, areas, modulos) VALUES
  ('admin',
   '["__todas__"]',
   '[{"empresa_id":"__todas__","areas":["__todas__"]}]',
   '["chat","contactos","infracciones","dashboard","usuarios","configuracion","etiquetas","notas_cierre"]'
  ),
  ('asesor',
   '["__todas__"]',
   '[{"empresa_id":"__todas__","areas":["__todas__"]}]',
   '["chat","contactos","etiquetas","notas_cierre"]'
  ),
  ('ti',
   '["__todas__"]',
   '[{"empresa_id":"__todas__","areas":["__todas__"]}]',
   '["chat","infracciones","contactos","dashboard"]'
  )
ON CONFLICT (rol) DO NOTHING;
