-- Avatar de agente: URL relativa al directorio uploads/avatars/.
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS foto_perfil VARCHAR(255);
