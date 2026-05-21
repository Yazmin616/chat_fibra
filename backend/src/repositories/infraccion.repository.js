const db = require('../config/db');

/**
 * Crea una infracción.
 * @param {string} tipo - 'area' (nadie tomó el chat) | 'agente' (agente no dio seguimiento)
 */
const create = (conversacion_id, empresa_id, departamento, cliente_nombre, tiempo_espera, tipo, agente_id, agente_nombre) =>
  db.query(
    `INSERT INTO infracciones
       (conversacion_id, empresa_id, departamento, cliente_nombre, tiempo_espera, tipo, agente_id, agente_nombre)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [conversacion_id, empresa_id, departamento, cliente_nombre, tiempo_espera, tipo, agente_id || null, agente_nombre || null]
  );

/**
 * Verifica si ya existe una infracción del mismo tipo para esta conversación.
 * Una conversación puede generar máximo una infracción de tipo 'area' y una de tipo 'agente'.
 */
const existsByConversacion = async (conversacion_id, tipo) => {
  const { rows } = await db.query(
    'SELECT 1 FROM infracciones WHERE conversacion_id=$1 AND tipo=$2 LIMIT 1',
    [conversacion_id, tipo]
  );
  return rows.length > 0;
};

/** Lista infracciones filtrando opcionalmente por empresa y/o área. */
const findAll = (empresa_id, departamento) => {
  const params  = [];
  const clauses = [];
  if (empresa_id && empresa_id !== 'todas') {
    params.push(empresa_id);
    clauses.push(`i.empresa_id=$${params.length}`);
  }
  if (departamento) {
    params.push(departamento);
    clauses.push(`i.departamento=$${params.length}`);
  }
  const where = clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';
  return db.query(
    `SELECT i.*, c.estado AS conv_estado
     FROM infracciones i
     LEFT JOIN conversaciones c ON i.conversacion_id=c.id
     ${where}
     ORDER BY i.created_at DESC`,
    params
  );
};

/** Cuenta las infracciones del día de hoy (para el badge del sidebar). */
const countToday = (empresa_id, departamento) => {
  const params  = [];
  const clauses = [`i.created_at::date = NOW()::date`];
  if (empresa_id && empresa_id !== 'todas') {
    params.push(empresa_id);
    clauses.push(`i.empresa_id=$${params.length}`);
  }
  if (departamento) {
    params.push(departamento);
    clauses.push(`i.departamento=$${params.length}`);
  }
  return db.query(
    `SELECT COUNT(*) AS total FROM infracciones i WHERE ${clauses.join(' AND ')}`,
    params
  );
};

module.exports = { create, existsByConversacion, findAll, countToday };
