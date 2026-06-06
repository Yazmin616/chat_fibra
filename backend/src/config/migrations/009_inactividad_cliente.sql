-- Soporte para el sistema de inactividad escalonada del cliente en conversaciones
-- con atención humana (cliente ↔ agente).
--
-- ultimo_mensaje_cliente : cuándo fue la última vez que el CLIENTE escribió.
--                          Solo se actualiza en bot.service.js (mensaje de usuario).
--                          Se inicializa a NOW() cuando el agente toma el chat
--                          (assignAgente en conversacion.repository.js).
--                          Anchla el timer de inactividad independientemente de
--                          cuándo respondió el agente.
--
-- aviso_inactividad_enviado : nivel de aviso ya enviado (0 = ninguno, 1 = primer
--                             recordatorio, 2 = aviso de cierre próximo).
--                             Se resetea a 0 cada vez que el cliente escribe.

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS ultimo_mensaje_cliente     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_inactividad_enviado  SMALLINT NOT NULL DEFAULT 0;

-- Retrocompatibilidad: inicializar conversaciones 'atendiendo' existentes.
-- Se usa updated_at como mejor estimación del momento de actividad.
UPDATE conversaciones
  SET ultimo_mensaje_cliente = updated_at
  WHERE estado = 'atendiendo'
    AND ultimo_mensaje_cliente IS NULL;
