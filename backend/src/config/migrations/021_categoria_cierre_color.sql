-- ============================================================
-- Migración 021: Agregar color a categorías de cierre
-- ============================================================

ALTER TABLE categoria_cierre
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6366f1';

-- Actualizar categorías existentes con colores distintivos
UPDATE categoria_cierre SET color = '#22c55e' WHERE nombre = 'Problema resuelto'     AND color IS NULL;
UPDATE categoria_cierre SET color = '#ef4444' WHERE nombre = 'Sin solución disponible' AND color IS NULL;
UPDATE categoria_cierre SET color = '#f59e0b' WHERE nombre = 'Cliente desistió'       AND color IS NULL;
UPDATE categoria_cierre SET color = '#3b82f6' WHERE nombre = 'Derivado a otro área'   AND color IS NULL;
UPDATE categoria_cierre SET color = '#10b981' WHERE nombre LIKE 'Falla%'              AND color IS NULL;
UPDATE categoria_cierre SET color = '#8b5cf6' WHERE nombre LIKE '%cobro%'             AND color IS NULL;
UPDATE categoria_cierre SET color = '#ec4899' WHERE nombre LIKE '%Venta%'             AND color IS NULL;

-- El resto con color por defecto
UPDATE categoria_cierre SET color = '#6366f1' WHERE color IS NULL;

-- Hacer color NOT NULL tras los updates
ALTER TABLE categoria_cierre
  ALTER COLUMN color SET NOT NULL;