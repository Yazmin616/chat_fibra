/**
 * @file tickets.repository.js
 * @description Repositorio de base de datos para Tickets y Tareas de TI.
 */

const db = require('../config/db');

/**
 * Obtiene lista de tickets con filtros opcionales.
 */
async function findAll({ estado, tipo, prioridad, asignado_id, solicitante_id, q, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let pIdx = 1;

  if (estado && estado !== 'todos') {
    conditions.push(`t.estado = $${pIdx++}`);
    params.push(estado);
  }

  if (tipo && tipo !== 'todos') {
    conditions.push(`t.tipo = $${pIdx++}`);
    params.push(tipo);
  }

  if (prioridad && prioridad !== 'todas') {
    conditions.push(`t.prioridad = $${pIdx++}`);
    params.push(prioridad);
  }

  if (asignado_id) {
    conditions.push(`t.asignado_id = $${pIdx++}`);
    params.push(Number(asignado_id));
  }

  if (solicitante_id) {
    conditions.push(`t.solicitante_id = $${pIdx++}`);
    params.push(Number(solicitante_id));
  }

  if (q && q.trim()) {
    conditions.push(`(t.titulo ILIKE $${pIdx} OR t.descripcion ILIKE $${pIdx} OR t.folio ILIKE $${pIdx} OR t.solicitante_nombre ILIKE $${pIdx} OR s.nombre ILIKE $${pIdx})`);
    params.push(`%${q.trim()}%`);
    pIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      t.id,
      t.folio,
      t.titulo,
      t.descripcion,
      t.tipo,
      t.prioridad,
      t.estado,
      t.solicitante_id,
      COALESCE(s.nombre, t.solicitante_nombre, 'No especificado') AS solicitante_nombre_final,
      t.solicitante_nombre,
      s.nombre AS solicitante_agente_nombre,
      s.email AS solicitante_agente_email,
      s.foto_perfil AS solicitante_agente_foto,
      t.asignado_id,
      a.nombre AS asignado_nombre,
      a.email AS asignado_email,
      a.foto_perfil AS asignado_foto,
      t.notas_resolucion,
      t.created_at,
      t.updated_at,
      t.resuelto_at,
      COUNT(c.id)::INT AS total_comentarios
    FROM tickets_ti t
    LEFT JOIN agentes s ON s.id = t.solicitante_id
    LEFT JOIN agentes a ON a.id = t.asignado_id
    LEFT JOIN ticket_ti_comentarios c ON c.ticket_id = t.id
    ${whereClause}
    GROUP BY t.id, s.nombre, s.email, s.foto_perfil, a.nombre, a.email, a.foto_perfil
    ORDER BY 
      CASE WHEN t.prioridad = 'urgente' AND t.estado NOT IN ('resuelto', 'cancelado') THEN 0 ELSE 1 END,
      t.updated_at DESC
    LIMIT $${pIdx++} OFFSET $${pIdx++}
  `;

  params.push(limit, offset);
  const { rows } = await db.query(query, params);
  return rows;
}

/**
 * Obtiene un ticket por su ID con datos completos.
 */
async function findById(id) {
  const query = `
    SELECT 
      t.id,
      t.folio,
      t.titulo,
      t.descripcion,
      t.tipo,
      t.prioridad,
      t.estado,
      t.solicitante_id,
      COALESCE(s.nombre, t.solicitante_nombre, 'No especificado') AS solicitante_nombre_final,
      t.solicitante_nombre,
      s.nombre AS solicitante_agente_nombre,
      s.email AS solicitante_agente_email,
      s.foto_perfil AS solicitante_agente_foto,
      t.asignado_id,
      a.nombre AS asignado_nombre,
      a.email AS asignado_email,
      a.foto_perfil AS asignado_foto,
      t.notas_resolucion,
      t.created_at,
      t.updated_at,
      t.resuelto_at
    FROM tickets_ti t
    LEFT JOIN agentes s ON s.id = t.solicitante_id
    LEFT JOIN agentes a ON a.id = t.asignado_id
    WHERE t.id = $1
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
}

/**
 * Inserta un nuevo ticket de TI.
 */
async function create({
  titulo,
  descripcion,
  tipo = 'error',
  prioridad = 'media',
  estado = 'abierto',
  solicitante_id = null,
  solicitante_nombre = null,
  asignado_id = null,
}) {
  const query = `
    INSERT INTO tickets_ti (
      titulo, descripcion, tipo, prioridad, estado, solicitante_id, solicitante_nombre, asignado_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const { rows } = await db.query(query, [
    titulo.trim(),
    descripcion.trim(),
    tipo,
    prioridad,
    estado,
    solicitante_id ? Number(solicitante_id) : null,
    solicitante_nombre ? solicitante_nombre.trim() : null,
    asignado_id ? Number(asignado_id) : null,
  ]);
  return rows[0];
}

/**
 * Actualiza los campos de un ticket.
 */
async function update(id, fields) {
  const sets = [];
  const params = [];
  let pIdx = 1;

  if (fields.titulo !== undefined) {
    sets.push(`titulo = $${pIdx++}`);
    params.push(fields.titulo.trim());
  }

  if (fields.descripcion !== undefined) {
    sets.push(`descripcion = $${pIdx++}`);
    params.push(fields.descripcion.trim());
  }

  if (fields.tipo !== undefined) {
    sets.push(`tipo = $${pIdx++}`);
    params.push(fields.tipo);
  }

  if (fields.prioridad !== undefined) {
    sets.push(`prioridad = $${pIdx++}`);
    params.push(fields.prioridad);
  }

  if (fields.estado !== undefined) {
    sets.push(`estado = $${pIdx++}`);
    params.push(fields.estado);

    if (fields.estado === 'resuelto') {
      sets.push(`resuelto_at = NOW()`);
    } else {
      sets.push(`resuelto_at = NULL`);
    }
  }

  if (fields.asignado_id !== undefined) {
    sets.push(`asignado_id = $${pIdx++}`);
    params.push(fields.asignado_id ? Number(fields.asignado_id) : null);
  }

  if (fields.solicitante_nombre !== undefined) {
    sets.push(`solicitante_nombre = $${pIdx++}`);
    params.push(fields.solicitante_nombre ? fields.solicitante_nombre.trim() : null);
  }

  if (fields.notas_resolucion !== undefined) {
    sets.push(`notas_resolucion = $${pIdx++}`);
    params.push(fields.notas_resolucion ? fields.notas_resolucion.trim() : null);
  }

  sets.push(`updated_at = NOW()`);

  params.push(Number(id));
  const query = `
    UPDATE tickets_ti
    SET ${sets.join(', ')}
    WHERE id = $${pIdx}
    RETURNING *
  `;

  const { rows } = await db.query(query, params);
  return rows[0] || null;
}

/**
 * Elimina un ticket por su ID.
 */
async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM tickets_ti WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Obtiene métricas y contadores de tickets para el dashboard de TI.
 */
async function getStats(solicitante_id = null) {
  let where = '';
  const params = [];
  if (solicitante_id) {
    where = 'WHERE solicitante_id = $1';
    params.push(Number(solicitante_id));
  }
  const query = `
    SELECT
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE estado = 'abierto')::INT AS abiertos,
      COUNT(*) FILTER (WHERE estado = 'en_progreso')::INT AS en_progreso,
      COUNT(*) FILTER (WHERE estado = 'revision')::INT AS revision,
      COUNT(*) FILTER (WHERE estado = 'resuelto')::INT AS resueltos,
      COUNT(*) FILTER (WHERE prioridad = 'urgente' AND estado NOT IN ('resuelto', 'cancelado'))::INT AS urgentes,
      COUNT(*) FILTER (WHERE estado = 'resuelto' AND resuelto_at >= CURRENT_DATE)::INT AS resueltos_hoy
    FROM tickets_ti
    ${where}
  `;
  const { rows } = await db.query(query, params);
  return rows[0];
}

/**
 * Añade un comentario a la bitácora del ticket.
 */
async function addComentario(ticketId, agenteId, comentario) {
  const query = `
    INSERT INTO ticket_ti_comentarios (ticket_id, agente_id, comentario)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const { rows } = await db.query(query, [ticketId, agenteId, comentario.trim()]);
  return rows[0];
}

/**
 * Obtiene la lista de comentarios de un ticket con datos del autor.
 */
async function getComentarios(ticketId) {
  const query = `
    SELECT 
      c.id,
      c.ticket_id,
      c.agente_id,
      c.comentario,
      c.created_at,
      a.nombre AS agente_nombre,
      a.email AS agente_email,
      a.foto_perfil AS agente_foto,
      a.rol AS agente_rol
    FROM ticket_ti_comentarios c
    LEFT JOIN agentes a ON a.id = c.agente_id
    WHERE c.ticket_id = $1
    ORDER BY c.created_at ASC
  `;
  const { rows } = await db.query(query, [ticketId]);
  return rows;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  getStats,
  addComentario,
  getComentarios,
};
