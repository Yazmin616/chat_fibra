/**
 * @file mensaje.repository.js
 * @description Capa de acceso a datos para la tabla `mensajes`.
 *
 * Cada mensaje pertenece a una conversación y tiene un remitente que indica
 * su origen:
 *   - "user"           → mensaje del cliente (vía Telegram)
 *   - "bot"            → respuesta automática del chatbot
 *   - "agente"         → mensaje enviado manualmente por un agente del CRM
 *   - "sistema_info"   → banner informativo del sistema (ej. "cliente en espera")
 *   - "sistema_success"→ banner de cierre o finalización de chat
 */

const db = require('../config/db');

/**
 * Inserta un nuevo mensaje en una conversación.
 * También usada para insertar banners del sistema (remitente = "sistema_*").
 * @param {number}      conversacion_id - PK de la conversación.
 * @param {string}      remitente       - Origen del mensaje ("user", "bot", "agente", etc.).
 * @param {string}      texto           - Contenido del mensaje.
 * @param {string}      [tipo]          - Tipo de contenido: "text" (default) o "sticker".
 * @param {string|null} [url_media]     - URL del archivo de media (para stickers/imágenes).
 * @returns {Promise<import('pg').QueryResult>}
 */
const create = (conversacion_id, remitente, texto, tipo = 'text', url_media = null, telegram_msg_id = null, agente_id = null) =>
  db.query(
    `INSERT INTO mensajes (conversacion_id, remitente, texto, tipo, url_media, telegram_msg_id, agente_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
    [conversacion_id, remitente, texto, tipo, url_media, telegram_msg_id, agente_id]
  );

/** Encuentra un mensaje por su ID de Telegram (para vincular reacciones). */
const findByTelegramMsgId = (telegram_msg_id, empresa_id, external_id) =>
  db.query(
    `SELECT m.id, m.conversacion_id, m.remitente, m.reacciones, c.departamento
     FROM mensajes m
     JOIN conversaciones c ON c.id = m.conversacion_id
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE m.telegram_msg_id = $1
       AND c.empresa_id = $2
       AND u.external_id = $3
       AND u.canal = 'telegram'
     LIMIT 1`,
    [telegram_msg_id, empresa_id, external_id]
  );

/** Actualiza el campo reacciones JSONB de un mensaje. */
const updateReacciones = (id, reacciones) =>
  db.query(
    'UPDATE mensajes SET reacciones=$1 WHERE id=$2',
    [JSON.stringify(reacciones), id]
  );

/**
 * Avanza el estado de un mensaje de agente/bot a 'entregado'.
 * Se llama cuando el canal externo (Telegram, Meta…) confirma la recepción.
 * @param {number} id - PK del mensaje.
 */
const updateEstado = (id) =>
  db.query("UPDATE mensajes SET estado='entregado' WHERE id=$1", [id]);

/**
 * Avanza a 'leido' todos los mensajes de agente/bot en una conversación
 * que aún no estén en ese estado. Retorna los IDs actualizados.
 *
 * Para Telegram: se invoca cuando el cliente envía un mensaje nuevo (confirmación
 * implícita — es lo mejor que la API de Telegram permite a un bot).
 * Para Meta/WhatsApp: se invocará desde el webhook de read-receipt real.
 *
 * @param {number} conversacion_id
 * @returns {Promise<import('pg').QueryResult>}
 */
const marcarLeidosPorConversacion = (conversacion_id) =>
  db.query(
    `UPDATE mensajes SET estado='leido'
     WHERE conversacion_id=$1
       AND remitente IN ('agente','bot')
       AND estado != 'leido'
     RETURNING id`,
    [conversacion_id]
  );

/**
 * Elimina todos los mensajes de una lista de conversaciones (borrado total GDPR).
 * @param {number[]} ids - Array de PKs de conversaciones.
 * @returns {Promise<import('pg').QueryResult>}
 */
const deleteByConversacionIds = (ids) =>
  db.query('DELETE FROM mensajes WHERE conversacion_id=ANY($1)', [ids]);

/**
 * Marca como leídos todos los mensajes del cliente en una conversación específica.
 * Sustituye a markReadByUsuario para evitar marcar mensajes de otras empresas.
 * @param {number} conversacion_id - PK de la conversación.
 * @returns {Promise<import('pg').QueryResult>}
 */
const markReadByConversacion = (conversacion_id) =>
  db.query(
    `UPDATE mensajes SET leido=true
     WHERE conversacion_id=$1 AND remitente IN ('user', 'sistema_info') AND leido=false`,
    [conversacion_id]
  );

/**
 * @deprecated Usar markReadByConversacion para no cruzar empresas.
 * Marca como leídos todos los mensajes del cliente en TODAS las conversaciones del usuario.
 * @param {number} usuario_id
 */
const markReadByUsuario = (usuario_id) =>
  db.query(
    `UPDATE mensajes SET leido=true
     WHERE conversacion_id IN (SELECT id FROM conversaciones WHERE usuario_id=$1)
       AND remitente='user' AND leido=false`,
    [usuario_id]
  );

/**
 * Obtiene todos los mensajes de una conversación en orden cronológico.
 * @param {number} conversacion_id - PK de la conversación.
 * @returns {Promise<import('pg').QueryResult>}
 */
const getByConversacion = (conversacion_id) =>
  db.query(
    `SELECT m.*, a.nombre AS agente_nombre
     FROM mensajes m
     LEFT JOIN agentes a ON a.id = m.agente_id
     WHERE m.conversacion_id=$1
     ORDER BY m.id ASC`,
    [conversacion_id]
  );

/**
 * Obtiene el historial completo de mensajes de un usuario en una empresa,
 * cruzando todas sus conversaciones. Usado por Admin para ver el historial
 * unificado sin perder mensajes de conversaciones anteriores.
 * @param {number} usuario_id - PK del usuario.
 * @param {string} empresa_id - Empresa a la que pertenecen las conversaciones.
 * @returns {Promise<import('pg').QueryResult>}
 */
const getByUsuarioAndEmpresa = (usuario_id, empresa_id) =>
  db.query(
    `SELECT m.*, a.nombre AS agente_nombre
     FROM mensajes m
     JOIN conversaciones c ON m.conversacion_id=c.id
     LEFT JOIN agentes a ON a.id = m.agente_id
     WHERE c.usuario_id=$1 AND c.empresa_id=$2
     ORDER BY m.id ASC`,
    [usuario_id, empresa_id]
  );

/**
 * Obtiene el historial completo de mensajes de un usuario (todas sus conversaciones).
 * Usado por el rol Admin para ver el historial unificado sin importar el área.
 * @param {number} usuario_id - PK del usuario.
 * @returns {Promise<import('pg').QueryResult>}
 */
const getByUsuario = (usuario_id) =>
  db.query(
    `SELECT m.*, a.nombre AS agente_nombre
     FROM mensajes m
     JOIN conversaciones c ON m.conversacion_id=c.id
     LEFT JOIN agentes a ON a.id = m.agente_id
     WHERE c.usuario_id=$1
     ORDER BY m.id ASC`,
    [usuario_id]
  );

/**
 * Obtiene los mensajes de un usuario filtrados por área y empresa.
 * Usado por Asesores para ver solo los mensajes de su área con ese usuario,
 * sin mezclar mensajes de la misma área en otra empresa.
 * @param {number} usuario_id - PK del usuario.
 * @param {string} area       - Departamento: "Ventas", "Cobranza" o "Soporte Técnico".
 * @param {string} empresa_id - Empresa propietaria de la conversación.
 * @returns {Promise<import('pg').QueryResult>}
 */
const getByUsuarioAndArea = (usuario_id, area, empresa_id) =>
  db.query(
    `SELECT m.*, a.nombre AS agente_nombre
     FROM mensajes m
     JOIN conversaciones c ON m.conversacion_id=c.id
     LEFT JOIN agentes a ON a.id = m.agente_id
     WHERE c.usuario_id=$1 AND c.departamento=$2 AND c.empresa_id=$3
     ORDER BY m.id ASC`,
    [usuario_id, area, empresa_id]
  );

/**
 * Busca un mensaje por su WhatsApp Message ID (wamid).
 * Hace JOIN con conversaciones para obtener el departamento (necesario para el emit de socket).
 * @param {string} wamid
 * @returns {Promise<import('pg').QueryResult>}
 */
/**
 * Devuelve el wamid del último mensaje del cliente en una conversación.
 * Usado para enviar read receipt cuando el agente abre el chat o empieza a escribir.
 * @param {number} conversacion_id
 * @returns {Promise<import('pg').QueryResult>}
 */
const findLastUserWamidByConversacion = (conversacion_id) =>
  db.query(
    `SELECT wamid FROM mensajes
     WHERE conversacion_id=$1 AND remitente='user' AND wamid IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
    [conversacion_id]
  );

const findByWamid = (wamid) =>
  db.query(
    `SELECT m.id, m.conversacion_id, c.departamento
     FROM mensajes m
     JOIN conversaciones c ON c.id = m.conversacion_id
     WHERE m.wamid = $1
     LIMIT 1`,
    [wamid]
  );

/**
 * Actualiza el estado de un mensaje a un valor específico.
 * A diferencia de updateEstado() (hardcodeado a 'entregado'), acepta cualquier estado.
 * Usado para los status webhooks de WhatsApp: 'enviado', 'entregado', 'leido'.
 * @param {number} id     - PK del mensaje.
 * @param {string} estado - Nuevo estado.
 * @returns {Promise<import('pg').QueryResult>}
 */
const updateEstadoById = (id, estado) =>
  db.query('UPDATE mensajes SET estado=$1 WHERE id=$2', [estado, id]);

module.exports = {
  create,
  findByTelegramMsgId,
  updateReacciones,
  updateEstado,
  updateEstadoById,
  findByWamid,
  findLastUserWamidByConversacion,
  marcarLeidosPorConversacion,
  deleteByConversacionIds,
  markReadByConversacion,
  markReadByUsuario,
  getByConversacion,
  getByUsuario,
  getByUsuarioAndArea,
  getByUsuarioAndEmpresa,
};
