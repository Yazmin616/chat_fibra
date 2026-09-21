-- =============================================================================
-- 046 - Eliminar canales grupales base para dejar solo contactos de usuarios
-- =============================================================================

-- Eliminar todos los canales grupales existentes (la cascada borra miembros, mensajes, etc.)
DELETE FROM chat_interno_canales WHERE tipo = 'canal';
