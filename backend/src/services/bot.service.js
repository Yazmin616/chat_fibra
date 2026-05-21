/**
 * @file bot.service.js
 * @description Punto de entrada del chatbot: orquesta upserts de usuario/conversación,
 * persistencia de mensajes y despacha al handler del estado actual.
 *
 * Flujo de estados de una conversación:
 *   abierta / inicio
 *     └→ SELECCION_EMPRESA  (si el bot no tiene empresa preconfigurada)
 *         └→ SELECCION_AREA
 *     └→ SELECCION_AREA     (si el bot ya sabe la empresa — multi-bot)
 *         └→ ESPERANDO_AGENTE (nueva conversación)
 *             └→ atendiendo  (agente responde)
 *                 └→ ENCUESTA_AGENTE / ENCUESTA_BOT
 *                     └→ cerrada
 *
 * No hace I/O HTTP; recibe `input` de cualquier adaptador y devuelve
 * { texto, conversacion_id } o null si un humano ya atiende el chat.
 */

const usuarioRepo      = require('../repositories/usuario.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const logger           = require('../config/logger');
const { getHandler }   = require('../bot/dispatcher');

/**
 * Procesa un mensaje entrante y devuelve la respuesta del bot.
 *
 * @param {object}      input
 * @param {string}      input.canal                 - Canal de origen, ej. "telegram".
 * @param {string}      input.user_id               - ID externo del usuario en el canal.
 * @param {string}      input.nombre                - Nombre del usuario.
 * @param {string}      input.username              - Alias del usuario.
 * @param {string}      input.empresa_id            - Empresa asociada al bot que recibió el mensaje.
 * @param {string}      input.mensaje               - Texto del mensaje.
 * @param {string}      [input.tipo='text']         - "text", "sticker", "photo" o "location".
 * @param {string|null} [input.url_media]           - URL del archivo (sticker/foto) o enlace de Maps (location).
 * @param {boolean}     [input.empresa_preconfigurada=false] - true si la empresa viene del bot,
 *                                                   false si el cliente aún debe elegirla en el menú.
 * @param {import('socket.io').Server} [io]
 * @returns {Promise<{ texto: string|null, conversacion_id: number } | null>}
 *   null  → el chat ya tiene un humano asignado; el bot no interviene.
 */
async function procesar(input, io) {
  const usuario     = await _upsertUsuario(input);
  const conversacion = await _upsertConversacion(usuario.id, input.empresa_id || 'fibratec');

  await mensajeRepo.create(conversacion.id, 'user', input.mensaje, input.tipo || 'text', input.url_media, input.telegram_msg_id || null);

  if (conversacion.es_humano) return null;

  return _maquinaEstados(
    input.mensaje,
    conversacion,
    usuario,
    io,
    input.empresa_preconfigurada || false
  );
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

/**
 * Busca el usuario por canal+external_id; lo crea si no existe, actualiza si ya existe.
 * @private
 */
async function _upsertUsuario({ canal, user_id, nombre, username }) {
  const { rows } = await usuarioRepo.findByCanal(canal, user_id);
  if (rows.length > 0) {
    await usuarioRepo.update(rows[0].id, nombre, username, null);
    return rows[0];
  }
  return (await usuarioRepo.create(canal, user_id, nombre, username, null)).rows[0];
}

/**
 * Busca la conversación activa del usuario; crea una nueva en "abierta" si no hay ninguna.
 * @private
 */
async function _upsertConversacion(usuario_id, empresa_id) {
  const { rows } = await conversacionRepo.findActiveByUsuario(usuario_id, empresa_id);
  if (rows.length > 0) return rows[0];
  return (await conversacionRepo.create(usuario_id, empresa_id)).rows[0];
}

/**
 * Despacha el mensaje al handler del estado actual y actualiza la DB.
 * @private
 */
async function _maquinaEstados(mensaje, conversacion, usuario, io, empresaPreconfigurada) {
  try {
    const handler = getHandler(conversacion.estado);
    if (!handler) {
      logger.warn(`[BOT SERVICE] Estado desconocido: "${conversacion.estado}" — ignorando.`);
      return { texto: null, conversacion_id: conversacion.id };
    }

    const resultado = await handler.handle(mensaje, conversacion, usuario, io, empresaPreconfigurada);

    // SELECCION_AREA hace early return porque la conversación activa cambia de ID
    if (resultado.earlyReturn) return resultado.resultado;

    const { respuesta, nuevoEstado } = resultado;
    await conversacionRepo.updateEstado(conversacion.id, nuevoEstado);
    if (respuesta) await mensajeRepo.create(conversacion.id, 'bot', respuesta);
    return { texto: respuesta, conversacion_id: conversacion.id };

  } catch (err) {
    logger.error('[BOT SERVICE] Error en máquina de estados:', { error: err.message, stack: err.stack });
    const fallback = "Lo sentimos, hubo un error. Escriba 'hola' para reiniciar.";
    await conversacionRepo.updateEstado(conversacion.id, 'inicio');
    await mensajeRepo.create(conversacion.id, 'bot', fallback);
    return { texto: fallback, conversacion_id: conversacion.id };
  }
}

module.exports = { procesar };
