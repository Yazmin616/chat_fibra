/**
 * @file usuario.repository.js
 * @description Capa de acceso a datos para la tabla `usuarios`.
 *
 * Un "usuario" es el cliente externo que escribe por Telegram (u otro canal).
 * Este módulo contiene ÚNICAMENTE queries SQL; no tiene lógica de negocio.
 * Todas las queries usan parámetros posicionales ($1, $2…) para prevenir SQL injection.
 */

const db = require('../config/db');

/**
 * Busca un usuario por canal y su ID externo (ej. Telegram ID).
 * @param {string} canal       - Canal de origen, ej. "telegram".
 * @param {string} external_id - ID único del usuario en ese canal.
 * @returns {Promise<import('pg').QueryResult>} Fila(s) del usuario encontrado.
 */
const findByCanal = (canal, external_id) =>
  db.query('SELECT * FROM usuarios WHERE canal=$1 AND external_id=$2', [canal, external_id]);

/**
 * Inserta un nuevo usuario.
 * @param {string}      canal       - Canal de origen.
 * @param {string}      external_id - ID único en el canal.
 * @param {string}      nombre      - Nombre completo.
 * @param {string}      username    - Alias/usuario (puede ser vacío).
 * @param {string|null} telefono    - Teléfono (opcional).
 * @returns {Promise<import('pg').QueryResult>} Fila del usuario creado.
 */
const create = (canal, external_id, nombre, username, telefono) =>
  db.query(
    'INSERT INTO usuarios (canal, external_id, nombre, username, telefono) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [canal, external_id, nombre, username, telefono]
  );

/**
 * Actualiza nombre, username y/o teléfono de un usuario existente.
 * `telefono` usa COALESCE para no sobreescribir un teléfono registrado con NULL.
 * @param {number}      id       - PK del usuario.
 * @param {string}      nombre   - Nuevo nombre.
 * @param {string}      username - Nuevo username.
 * @param {string|null} telefono - Nuevo teléfono (null = no modificar).
 * @returns {Promise<import('pg').QueryResult>}
 */
const update = (id, nombre, username, telefono) =>
  db.query(
    'UPDATE usuarios SET nombre=$1, username=$2, telefono=COALESCE($3,telefono) WHERE id=$4',
    [nombre, username, telefono, id]
  );

/**
 * Elimina un usuario por su PK (usado en borrado total GDPR).
 * @param {number} id - PK del usuario.
 * @returns {Promise<import('pg').QueryResult>}
 */
const remove = (id) =>
  db.query('DELETE FROM usuarios WHERE id=$1', [id]);

/**
 * Lista todos los usuarios con métricas agregadas de sus conversaciones.
 * Ordenados por fecha de última interacción (más reciente primero).
 * @returns {Promise<import('pg').QueryResult>} Filas con campos extra: ultima_interaccion, total_chats.
 */
const findAll = () =>
  db.query(`
    SELECT
      u.*,
      (SELECT MAX(created_at) FROM conversaciones WHERE usuario_id=u.id) AS ultima_interaccion,
      (SELECT COUNT(*) FROM conversaciones WHERE usuario_id=u.id) AS total_chats
    FROM usuarios u
    ORDER BY ultima_interaccion DESC NULLS LAST
  `);

/**
 * Actualiza los datos de contacto editables desde el panel CRM.
 * @param {number} id       - PK del usuario.
 * @param {string} nombre   - Nombre a establecer.
 * @param {string} telefono - Teléfono a establecer.
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateContacto = (id, nombre, telefono) =>
  db.query('UPDATE usuarios SET nombre=$1, telefono=$2 WHERE id=$3', [nombre, telefono, id]);

/**
 * Guarda o actualiza los datos WISP del cliente (nombre + servicios).
 * Se llama cuando el cliente se identifica exitosamente para que no tenga
 * que volver a hacerlo en conversaciones futuras.
 * @param {number} id       - PK del usuario.
 * @param {object} wispData - Objeto { nombre, servicios } devuelto por el mock/API WISP.
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateWispData = (id, wispData) =>
  db.query('UPDATE usuarios SET wisp_data=$1 WHERE id=$2', [JSON.stringify(wispData), id]);

module.exports = { findByCanal, create, update, remove, findAll, updateContacto, updateWispData };
