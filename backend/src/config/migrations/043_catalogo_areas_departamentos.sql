-- =============================================================================
-- Migración 043: Catálogo completo de Áreas y Departamentos
-- Garantiza la existencia de la tabla y puebla las 14 áreas estándar del sistema
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.areas_soluciones (
  id             SERIAL PRIMARY KEY,
  empresa_id     JSONB NOT NULL DEFAULT '["todas"]'::jsonb,
  nombre_area    VARCHAR(120) NOT NULL,
  descripcion    TEXT DEFAULT '',
  soluciones     JSONB DEFAULT '[]'::jsonb,
  activo         BOOLEAN NOT NULL DEFAULT true,
  coordinador_id INT REFERENCES public.agentes(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.areas_soluciones ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';
ALTER TABLE public.areas_soluciones ADD COLUMN IF NOT EXISTS soluciones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.areas_soluciones ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.areas_soluciones ADD COLUMN IF NOT EXISTS coordinador_id INT REFERENCES public.agentes(id) ON DELETE SET NULL;
ALTER TABLE public.areas_soluciones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.areas_soluciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Crear índice único por nombre en minúsculas para prevenir duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_areas_soluciones_nombre_lower ON public.areas_soluciones(LOWER(TRIM(nombre_area)));

-- Insertar áreas base si no existen
INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'NOC (Centro de Operaciones de Red)', 'Monitoreo y gestión de infraestructura de red y enlaces', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('NOC (Centro de Operaciones de Red)'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Dirección General', 'Alta dirección y decisiones estratégicas corporativas', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Dirección General'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Recursos Humanos (RH)', 'Gestión de personal, reclutamiento y clima laboral', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Recursos Humanos (RH)'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Administración y Finanzas', 'Control presupuestal, compras y pagos corporativos', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Administración y Finanzas'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Contabilidad', 'Facturación fiscal, auditorías y declaraciones', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Contabilidad'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Sistemas / TI', 'Infraestructura informática, servidores y soporte interno', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Sistemas / TI'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Soporte Técnico', 'Atención a fallas de servicio, módems y conectividad de clientes', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Soporte Técnico'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Ventas', 'Contratación de nuevos servicios, promociones y prospectos', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Ventas'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Cobranza', 'Seguimiento de pagos, acuerdos, aclaraciones y reconexiones', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Cobranza'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Planta Externa / Fibra Óptica', 'Tendido de cableado, fusión de fibra y mantenimiento de postes', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Planta Externa / Fibra Óptica'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Instalaciones y Mantenimiento', 'Visitas técnicas a domicilio, altas de servicio y cableado interno', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Instalaciones y Mantenimiento'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Almacén y Logística', 'Control de inventario, equipos ONT, routers y herramientas', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Almacén y Logística'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'Atención a Clientes', 'Información general, dudas administrativas y canalización', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('Atención a Clientes'));

INSERT INTO public.areas_soluciones (empresa_id, nombre_area, descripcion, soluciones, activo)
SELECT '["todas"]'::jsonb, 'General', 'Área general corporativa', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.areas_soluciones WHERE LOWER(TRIM(nombre_area)) = LOWER('General'));
