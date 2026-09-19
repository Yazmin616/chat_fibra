-- ============================================================================
-- Migración 040: Sistema de Tickets y Solicitudes para Soporte TI / Sistemas
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS tickets_ti_folio_seq START 1;

CREATE TABLE IF NOT EXISTS tickets_ti (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(30) UNIQUE NOT NULL DEFAULT ('TK-' || LPAD(nextval('tickets_ti_folio_seq'::regclass)::TEXT, 4, '0')),
    titulo VARCHAR(250) NOT NULL,
    descripcion TEXT NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'error',        -- 'error', 'correccion', 'mejora', 'soporte', 'tarea'
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media',    -- 'baja', 'media', 'alta', 'urgente'
    estado VARCHAR(30) NOT NULL DEFAULT 'abierto',     -- 'abierto', 'en_progreso', 'revision', 'resuelto', 'cancelado'
    solicitante_id INT REFERENCES agentes(id) ON DELETE SET NULL,
    solicitante_nombre VARCHAR(150),
    asignado_id INT REFERENCES agentes(id) ON DELETE SET NULL,
    notas_resolucion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_at TIMESTAMPTZ
);

-- Índices para optimizar consultas en el tablero y filtros
CREATE INDEX IF NOT EXISTS idx_tickets_ti_estado ON tickets_ti(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_tipo ON tickets_ti(tipo);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_prioridad ON tickets_ti(prioridad);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_created_at ON tickets_ti(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_ti_asignado_id ON tickets_ti(asignado_id);

-- Tabla de comentarios y notas de seguimiento por ticket
CREATE TABLE IF NOT EXISTS ticket_ti_comentarios (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES tickets_ti(id) ON DELETE CASCADE,
    agente_id INT REFERENCES agentes(id) ON DELETE SET NULL,
    comentario TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_ti_comentarios_ticket_id ON ticket_ti_comentarios(ticket_id);
