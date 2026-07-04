-- Mapa de palabras clave → intención, configurable por empresa.
-- empresa_id = '__todas__' aplica a todas las empresas como fallback.
CREATE TABLE IF NOT EXISTS palabras_clave_bot (
  id         SERIAL PRIMARY KEY,
  empresa_id VARCHAR(100) NOT NULL DEFAULT '__todas__',
  intencion  VARCHAR(50)  NOT NULL,
  palabras   TEXT[]       NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT palabras_clave_bot_uq UNIQUE (empresa_id, intencion)
);

INSERT INTO palabras_clave_bot (empresa_id, intencion, palabras) VALUES
  ('__todas__', 'asesor',
   ARRAY['asesor','asesora','humano','humana','persona','agente','operador',
         'ayuda humana','hablar con alguien','quiero hablar',
         'hablar con una persona','comunicarme con alguien','atención','atencion']),
  ('__todas__', 'soporte',
   ARRAY['soporte','tecnico','técnico','falla','fallas','internet','red',
         'conexion','conexión','no funciona','no jala','sin internet',
         'problema','problemas','averia','avería','lento','velocidad']),
  ('__todas__', 'cobranza',
   ARRAY['cobranza','pago','pagar','factura','deuda','cobro','saldo',
         'adeudo','recibo','mensualidad','meses','cargo','cobran','cuanto debo','cuánto debo']),
  ('__todas__', 'ventas',
   ARRAY['ventas','contratar','contrato','servicio nuevo','nuevo servicio',
         'quiero contratar','precio','precios','planes','plan',
         'información','informacion','cotizar','cotizacion','cotización','instalar','instalacion','instalación'])
ON CONFLICT (empresa_id, intencion) DO NOTHING;
