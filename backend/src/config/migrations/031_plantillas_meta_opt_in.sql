-- Migración 031: Plantillas Meta y Opt-In
-- Descripción: Agrega soporte para el catálogo de plantillas de Meta y control de suscripción (opt-in).

-- 1. Añadir columna opt_in a usuarios para evitar spam
ALTER TABLE usuarios ADD COLUMN opt_in BOOLEAN DEFAULT TRUE;

-- 2. Crear tabla plantillas_meta
CREATE TABLE IF NOT EXISTS plantillas_meta (
    id SERIAL PRIMARY KEY,
    empresa_id VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    idioma VARCHAR(10) DEFAULT 'es',
    estado VARCHAR(20) DEFAULT 'APPROVED',
    cuerpo TEXT,
    variables JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
