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
  db.query(
    `SELECT a.*, c.nombre AS coordinador_nombre, c.email AS coordinador_email
     FROM agentes a
     LEFT JOIN agentes c ON c.id = a.coordinador_id
     WHERE a.id=$1`,
    [id]
  );

/**
 * Busca un agente por su usuario o email (usado en login y recuperación).
 * @param {string} identifier - Usuario o email.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findByUsuarioOrEmail = (identifier) => {
  const clean = (identifier || '').trim().toLowerCase();
  const prefix = clean.includes('@') ? clean.split('@')[0] : clean;
  return db.query(
    `SELECT a.*, c.nombre AS coordinador_nombre, c.email AS coordinador_email
     FROM agentes a
     LEFT JOIN agentes c ON c.id = a.coordinador_id
     WHERE LOWER(a.usuario) = $1 
        OR (a.email IS NOT NULL AND LOWER(a.email) = $1)
        OR (a.email IS NOT NULL AND LOWER(REPLACE(a.email, '.mx', '.com')) = $1)
        OR (a.email IS NOT NULL AND LOWER(REPLACE(a.email, '.com', '.mx')) = $1)
        OR LOWER(a.usuario) = $2`,
    [clean, prefix]
  );
};

/**
 * Busca un agente por su email (compatibilidad).
 * @param {string} email - Email del agente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findByEmail = (email) =>
  db.query('SELECT * FROM agentes WHERE LOWER(email)=$1', [email.toLowerCase()]);

/**
 * Lista todos los agentes sin exponer el campo `password`.
 * Ordenados por fecha de creación descendente.
 * @returns {Promise<import('pg').QueryResult>}
 */
const findAll = () =>
  db.query(
    `SELECT 
      a.id, a.usuario, a.nombre, a.email, a.rol, a.area, a.esta_online, a.estado_presencia, 
      a.mensaje_presencia, a.last_seen, a.created_at, a.foto_perfil,
      a.debe_cambiar_password, a.coordinador_id, a.puede_recuperar_auto,
      c.nombre AS coordinador_nombre,
      EXISTS(SELECT 1 FROM public.areas_soluciones WHERE coordinador_id = a.id) AS es_coordinador
     FROM agentes a
     LEFT JOIN agentes c ON c.id = a.coordinador_id
     ORDER BY a.created_at DESC`
  );

/**
 * Lista todos los agentes para el directorio público interno.
 * Solo campos necesarios para UI.
 */
const findAllDirectorio = () =>
  db.query(
    "SELECT id, usuario, nombre, area, esta_online FROM agentes ORDER BY area ASC, nombre ASC"
  );

/**
 * Inserta un nuevo agente en el sistema.
 */
const create = ({ usuario, nombre, email, hashedPassword, rol, area, coordinador_id = null, debe_cambiar_password = true, puede_recuperar_auto = false }) =>
  db.query(
    `INSERT INTO agentes (usuario, nombre, email, password, rol, area, coordinador_id, debe_cambiar_password, puede_recuperar_auto) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
     RETURNING id, usuario, nombre, email, rol, area, coordinador_id, debe_cambiar_password, puede_recuperar_auto`,
    [usuario, nombre, email || null, hashedPassword, rol, area, coordinador_id, debe_cambiar_password, puede_recuperar_auto]
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
 */
const update = ({ id, usuario, nombre, email, rol, area, coordinador_id = null, puede_recuperar_auto = false }) =>
  db.query(
    `UPDATE agentes 
     SET usuario=COALESCE($1, usuario), nombre=$2, email=$3, rol=$4, area=$5, coordinador_id=$6, puede_recuperar_auto=$7 
     WHERE id=$8 
     RETURNING id, usuario, nombre, email, rol, area, coordinador_id, puede_recuperar_auto`,
    [usuario || null, nombre, email || null, rol, area, coordinador_id, puede_recuperar_auto, id]
  );

/**
 * Actualiza los datos de un agente incluyendo nueva contraseña.
 */
const updateWithPassword = ({ id, usuario, nombre, email, hashedPassword, rol, area, coordinador_id = null, puede_recuperar_auto = false, debe_cambiar_password = false }) =>
  db.query(
    `UPDATE agentes 
     SET usuario=COALESCE($1, usuario), nombre=$2, email=$3, password=$4, rol=$5, area=$6, coordinador_id=$7, puede_recuperar_auto=$8, debe_cambiar_password=$9 
     WHERE id=$10 
     RETURNING id, usuario, nombre, email, rol, area, coordinador_id, puede_recuperar_auto, debe_cambiar_password`,
    [usuario || null, nombre, email || null, hashedPassword, rol, area, coordinador_id, puede_recuperar_auto, debe_cambiar_password, id]
  );

/**
 * Actualiza la contraseña y la bandera debe_cambiar_password.
 */
const updatePasswordAndDebeCambiar = (id, hashedPassword, debe_cambiar_password) =>
  db.query(
    `UPDATE agentes SET password=$1, debe_cambiar_password=$2 WHERE id=$3 RETURNING id, usuario, nombre, email, debe_cambiar_password`,
    [hashedPassword, debe_cambiar_password, id]
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

/**
 * Obtiene el siguiente agente online del área indicada que lleva más tiempo sin recibir un chat.
 * Para el algoritmo de asignación equitativa (Round-Robin).
 * @param {string} area 
 * @returns {Promise<import('pg').QueryResult>}
 */
const getNextAgentForRoundRobin = (area) =>
  db.query(
    'SELECT id FROM agentes WHERE esta_online = true AND area = $1 ORDER BY ultimo_chat_asignado ASC NULLS FIRST LIMIT 1',
    [area]
  );

/**
 * Actualiza el timestamp de última asignación de un agente (Round-Robin).
 * @param {number} id 
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateUltimoChatAsignado = (id) =>
  db.query('UPDATE agentes SET ultimo_chat_asignado = NOW() WHERE id = $1', [id]);

/**
 * Actualiza el estado de presencia personalizado del agente (disponible, reunion, ocupado, comida, ausente).
 * @param {number} id
 * @param {string} estado
 * @param {string|null} mensaje
 * @returns {Promise<import('pg').QueryResult>}
 */
const setEstadoPresencia = (id, estado, mensaje = null) =>
  db.query(
    'UPDATE agentes SET estado_presencia = $1, mensaje_presencia = $2 WHERE id = $3 RETURNING id, estado_presencia, mensaje_presencia',
    [estado, mensaje, id]
  );

module.exports = { 
  findById, findByEmail, findByUsuarioOrEmail, findAll, findAllDirectorio, create, remove, update, updateWithPassword, 
  updatePasswordAndDebeCambiar, setOnline, touchLastSeen, marcarInactivos, getNextAgentForRoundRobin, updateUltimoChatAsignado,
  setEstadoPresencia
};
