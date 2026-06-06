-- SLA del agente: rastreo del tiempo sin responder al cliente en conversaciones atendiendo.
--
-- sla_pendiente_desde : timestamp del último mensaje del CLIENTE que aún no ha sido respondido.
--   * Se fija en bot.service.js cuando el cliente escribe.
--   * Se borra en chat.service.js cuando el agente responde (texto o media).
--   * El autoClose calcula minutos LABORALES transcurridos y registra infracción si supera
--     el umbral configurado en `configuraciones.sla_agente_nivel1_min`.
--   * Al disparar la infracción también se borra (NULL) para no re-disparar hasta que el
--     cliente vuelva a escribir.

ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS sla_pendiente_desde TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conv_sla ON conversaciones(sla_pendiente_desde)
  WHERE sla_pendiente_desde IS NOT NULL;
