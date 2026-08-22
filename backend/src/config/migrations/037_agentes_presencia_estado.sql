-- 037_agentes_presencia_estado.sql
-- Agrega estado de presencia personalizado para agentes y colaboradores
-- Valores permitidos: 'disponible', 'reunion', 'ocupado', 'comida', 'ausente'

ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS estado_presencia VARCHAR(50) DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS mensaje_presencia VARCHAR(255) DEFAULT NULL;
