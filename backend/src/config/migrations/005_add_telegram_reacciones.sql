-- Permite vincular mensajes del bot con el message_id de Telegram
-- y almacenar las reacciones emoji que el cliente pone a los mensajes.
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS telegram_msg_id BIGINT;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS reacciones JSONB DEFAULT '[]';
