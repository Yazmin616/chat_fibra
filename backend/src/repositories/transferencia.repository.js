/**
 * @file transferencia.repository.js
 * @description Capa de acceso a datos para la tabla `transferencias`.
 * Registra cada transferencia de chat entre agentes/equipos (log de auditoría).
 */

const db = require('../config/db');

/**
 * Inserta un nuevo registro de transferencia.
 * @param {object} data
 * @param {number} data.conversacion_id
 * @param {string} data.empresa_id
 * @param {number} data.agente_origen_id
 * @param {string} data.agente_origen_nombre
 * @param {string} data.area_origen
 * @param {string} data.area_destino
 * @param {'mismo_equipo'|'entre_equipos'} data.tipo
 * @param {string} data.nota
 */
const create = ({ conversacion_id, empresa_id, agente_origen_id, agente_origen_nombre, area_origen, area_destino, tipo, nota }) =>
  db.query(
    `INSERT INTO transferencias
       (conversacion_id, empresa_id, agente_origen_id, agente_origen_nombre,
        area_origen, area_destino, tipo, nota)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [conversacion_id, empresa_id, agente_origen_id, agente_origen_nombre,
     area_origen, area_destino, tipo, nota]
  );

/**
 * Marca una transferencia como tomada cuando un agente del equipo receptor
 * toma el chat (responde por primera vez).
 */
const markTomada = (id, tomado_por_id, tomado_por_nombre) =>
  db.query(
    `UPDATE transferencias
     SET tomado_por_id=$1, tomado_por_nombre=$2, tomado_at=NOW()
     WHERE id=$3`,
    [tomado_por_id, tomado_por_nombre, id]
  );

/**
 * Devuelve el registro de transferencia pendiente (sin tomar) más reciente
 * de una conversación, para marcarlo cuando el nuevo agente responde.
 */
const findPendienteByConversacion = (conversacion_id) =>
  db.query(
    `SELECT * FROM transferencias
     WHERE conversacion_id=$1 AND tomado_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [conversacion_id]
  );

/**
 * Historial de transferencias de una conversación, en orden cronológico.
 */
const listByConversacion = (conversacion_id) =>
  db.query(
    `SELECT * FROM transferencias
     WHERE conversacion_id=$1
     ORDER BY created_at ASC`,
    [conversacion_id]
  );

/**
 * Lista todas las transferencias de una empresa (para el panel de supervisores).
 * @param {string} empresa_id - "todas" para ver todas las empresas.
 */
const listAll = (empresa_id) => {
  const todas = empresa_id === 'todas';
  const params = [];
  const where = !todas ? `WHERE empresa_id=$${params.push(empresa_id)}` : '';
  return db.query(
    `SELECT * FROM transferencias ${where} ORDER BY created_at DESC LIMIT 500`,
    params
  );
};

module.exports = { create, markTomada, findPendienteByConversacion, listByConversacion, listAll };
