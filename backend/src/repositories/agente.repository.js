/**
 * @file agente.repository.js
 * @description Capa de acceso a datos para la tabla `agentes`.
 *
 * Un "agente" es un empleado del CRM que atiende chats.
 * Roles existentes:
 *   - "admin"  → puede ver todas las conversaciones y gestionar agentes.
 *   - "asesor" → solo ve conversaciones de su área y chats asignados a él.
 */

const db = require('../config/db');

/**
 * Busca un agente por su PK (incluye el campo `password` para validación interna).
 * @param {number} id - PK del agente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findById = (id) =>
  db.query('SELECT * FROM agentes WHERE id=$1', [id]);

/**
 * Busca un agente por su email (usado en login).
 * @param {string} email - Email del agente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findByEmail = (email) =>
  db.query('SELECT * FROM agentes WHERE email=$1', [email]);

/**
 * Lista todos los agentes sin exponer el campo `password`.
 * Ordenados por fecha de creación descendente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findAll = () =>
  db.query(
    'SELECT id, nombre, email, rol, area, esta_online, last_seen, created_at FROM agentes ORDER BY created_at DESC'
  );

/**
 * Inserta un nuevo agente en el sistema.
 * @param {string} nombre         - Nombre completo.
 * @param {string} email          - Email (debe ser único).
 * @param {string} hashedPassword - Contraseña ya encriptada con bcrypt.
 * @param {string} rol            - "admin" o "asesor".
 * @param {string} area           - Área de trabajo: "Ventas", "Cobranza", "Soporte Técnico" o "General".
 * @returns {Promise<import('pg').QueryResult>} Fila con id, nombre y email del agente creado.
 */
const create = (nombre, email, hashedPassword, rol, area) =>
  db.query(
    'INSERT INTO agentes (nombre, email, password, rol, area) VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, email',
    [nombre, email, hashedPassword, rol, area]
  );

/**
 * Elimina un agente por su PK.
 * Precondición: desvincular sus conversaciones antes de llamar esto (FK constraint).
 * @param {number} id - PK del agente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const remove = (id) =>
  db.query('DELETE FROM agentes WHERE id=$1', [id]);

/**
 * Actualiza los datos de un agente (sin cambiar contraseña).
 * @param {number} id
 * @param {string} nombre
 * @param {string} email
 * @param {string} rol
 * @param {string} area
 * @returns {Promise<import('pg').QueryResult>}
 */
const update = (id, nombre, email, rol, area) =>
  db.query(
    'UPDATE agentes SET nombre=$1, email=$2, rol=$3, area=$4 WHERE id=$5 RETURNING id, nombre, email, rol, area',
    [nombre, email, rol, area, id]
  );

/**
 * Actualiza los datos de un agente incluyendo nueva contraseña.
 * @param {number} id
 * @param {string} nombre
 * @param {string} email
 * @param {string} hashedPassword
 * @param {string} rol
 * @param {string} area
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateWithPassword = (id, nombre, email, hashedPassword, rol, area) =>
  db.query(
    'UPDATE agentes SET nombre=$1, email=$2, password=$3, rol=$4, area=$5 WHERE id=$6 RETURNING id, nombre, email, rol, area',
    [nombre, email, hashedPassword, rol, area, id]
  );

/**
 * Actualiza el estado de conexión del agente (online/offline).
 * Al poner online=true también registra last_seen=NOW() para empezar el tracking.
 * @param {number}  id     - PK del agente.
 * @param {boolean} online - true = conectado, false = desconectado.
 * @returns {Promise<import('pg').QueryResult>}
 */
const setOnline = (id, online) =>
  online
    ? db.query('UPDATE agentes SET esta_online=true,  last_seen=NOW() WHERE id=$1', [id])
    : db.query('UPDATE agentes SET esta_online=false WHERE id=$1', [id]);

/**
 * Actualiza last_seen al momento actual para el agente indicado.
 * Usado por el heartbeat y por cualquier petición autenticada exitosa.
 * @param {number} id - PK del agente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const touchLastSeen = (id) =>
  db.query('UPDATE agentes SET last_seen=NOW() WHERE id=$1', [id]);

/**
 * Marca como offline a todos los agentes cuyo last_seen sea más antiguo que
 * el umbral de minutos indicado. Usado por el job de auto-offline.
 * @param {number} minutos - Tiempo máximo de inactividad.
 * @returns {Promise<import('pg').QueryResult>}
 */
const marcarInactivos = (minutos) =>
  db.query(
    `UPDATE agentes SET esta_online=false
     WHERE esta_online=true
       AND (last_seen IS NULL OR last_seen < NOW() - ($1 || ' minutes')::interval)`,
    [minutos]
  );

module.exports = { findById, findByEmail, findAll, create, remove, update, updateWithPassword, setOnline, touchLastSeen, marcarInactivos };
