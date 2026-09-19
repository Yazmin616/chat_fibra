-- ==============================================================================
-- 041 - Soporte de Usuario, Coordinadores y Recuperación en Agentes
-- ==============================================================================

ALTER TABLE agentes ADD COLUMN IF NOT EXISTS usuario VARCHAR(60) UNIQUE;
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS coordinador_id INTEGER REFERENCES agentes(id) ON DELETE SET NULL;
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS puede_recuperar_auto BOOLEAN NOT NULL DEFAULT FALSE;

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

UPDATE agentes 
SET puede_recuperar_auto = TRUE 
WHERE rol IN ('admin', 'ti') OR area IN ('Dirección General', 'Sistemas / TI');

CREATE INDEX IF NOT EXISTS idx_agentes_usuario ON agentes (LOWER(usuario));
CREATE INDEX IF NOT EXISTS idx_agentes_coordinador ON agentes (coordinador_id);
