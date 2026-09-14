-- =============================================================================
-- 038 - Fijar Chats y Canales (Pin Chat / WhatsApp Style)
-- =============================================================================

ALTER TABLE chat_interno_miembros
ADD COLUMN IF NOT EXISTS fijado BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fijado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cim_fijado ON chat_interno_miembros(fijado);
