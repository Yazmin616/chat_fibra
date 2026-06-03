-- Agrega la columna wamid para correlacionar mensajes enviados por WhatsApp
-- con los status webhooks de Meta (sent/delivered/read).
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS wamid VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_mensajes_wamid ON mensajes(wamid) WHERE wamid IS NOT NULL;
