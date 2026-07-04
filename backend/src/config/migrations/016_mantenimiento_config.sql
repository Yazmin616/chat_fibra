-- Migración 016: configuración del mensaje de mantenimiento
-- Inserta las 4 claves para cada empresa_id que ya aparece en configuraciones.
-- WHERE NOT EXISTS en lugar de ON CONFLICT para no depender de índices específicos.

DO $$
DECLARE
  eid TEXT;
BEGIN
  FOR eid IN
    SELECT DISTINCT empresa_id FROM configuraciones
  LOOP
    INSERT INTO configuraciones (clave, valor, empresa_id)
    SELECT 'msg_mantenimiento', '', eid
    WHERE NOT EXISTS (SELECT 1 FROM configuraciones WHERE clave='msg_mantenimiento' AND empresa_id=eid);

    INSERT INTO configuraciones (clave, valor, empresa_id)
    SELECT 'tel_soporte', '', eid
    WHERE NOT EXISTS (SELECT 1 FROM configuraciones WHERE clave='tel_soporte' AND empresa_id=eid);

    INSERT INTO configuraciones (clave, valor, empresa_id)
    SELECT 'tel_ventas', '', eid
    WHERE NOT EXISTS (SELECT 1 FROM configuraciones WHERE clave='tel_ventas' AND empresa_id=eid);

    INSERT INTO configuraciones (clave, valor, empresa_id)
    SELECT 'tel_cobranza', '', eid
    WHERE NOT EXISTS (SELECT 1 FROM configuraciones WHERE clave='tel_cobranza' AND empresa_id=eid);
  END LOOP;
END;
$$;
