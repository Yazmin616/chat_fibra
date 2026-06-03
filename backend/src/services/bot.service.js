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

const db               = require('../config/db');
const usuarioRepo      = require('../repositories/usuario.repository');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const logger           = require('../config/logger');
const { sanitize }     = require('../utils/logSanitizer');
const { getHandler }   = require('../bot/dispatcher');
const { ESTADOS }      = require('../bot/constants');

// ── Rate limiting por usuario ────────────────────────────────────────────────
// Evita que un cliente genere miles de registros enviando mensajes en ráfaga.
// La ventana es pequeña (500 ms): suficiente para filtrar floods automatizados
// sin afectar a usuarios reales que tardan al menos 1-2 s entre mensajes.
const COOLDOWN_MS  = 500;
const _ultimoProceso = new Map();

// Limpiar el Map cada hora para evitar memory leak en sesiones de larga duración.
setInterval(() => _ultimoProceso.clear(), 60 * 60 * 1000).unref();

function _estaEnCooldown(userId) {
  const ahora = Date.now();
  const ultimo = _ultimoProceso.get(userId);
  if (ultimo && (ahora - ultimo) < COOLDOWN_MS) return true;
  _ultimoProceso.set(userId, ahora);
  return false;
}

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
  // Descartar mensajes en ráfaga del mismo usuario (flood protection)
  if (_estaEnCooldown(input.user_id)) return null;

  const usuario     = await _upsertUsuario(input);
  const conversacion = await _upsertConversacion(usuario.id, input.empresa_id || 'fibratec');

  // Guardar en BD y capturar el ID para incluirlo en el evento de socket (dedup en frontend)
  const textoParaDB = input.mensaje_display || input.mensaje;
  const { rows: [msgRow] } = await mensajeRepo.create(conversacion.id, 'user', textoParaDB, input.tipo || 'text', input.url_media, input.telegram_msg_id || null);
  const mensaje_id = msgRow?.id ?? null;

  // Guardar wamid del mensaje entrante (para read receipts). Sin await — no debe bloquear
  // ni silenciar el flujo principal si la columna aún no existe (migración pendiente).
  if (input.wamid_entrante && mensaje_id) {
    db.query('UPDATE mensajes SET wamid=$1 WHERE id=$2', [input.wamid_entrante, mensaje_id])
      .catch(err => logger.warn('[BOT SERVICE] No se pudo guardar wamid_entrante:', err.message));
  }

  // Agente humano atiende: el bot no responde, pero devolvemos contexto para el emit de socket
  if (conversacion.es_humano) return { mensaje_id, conversacion, conversacion_id: conversacion.id };

  const resultado = await _maquinaEstados(
    input.mensaje,
    conversacion,
    usuario,
    io,
    input.empresa_preconfigurada || false
  );
  return resultado
    ? { ...resultado, mensaje_id, conversacion }
    : { mensaje_id, conversacion, conversacion_id: conversacion.id };
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

/**
 * Devuelve true si el nombre es un identificador técnico crudo (PSID, teléfono sin formato, etc.)
 * y por tanto no debería sobreescribir un nombre real ya guardado.
 * @private
 */
function _esNombreCrudo(nombre) {
  if (!nombre) return true;
  // PSID/IGSID: string de ≥ 10 dígitos
  if (/^\d{10,}$/.test(String(nombre))) return true;
  return false;
}

/**
 * Busca el usuario por canal+external_id; lo crea si no existe, actualiza si ya existe.
 * Preserva el nombre guardado en DB si ya es un nombre real (WISP, Graph API, etc.)
 * para evitar que nombres buenos sean sobreescritos por PSIDs o teléfonos crudos.
 * @private
 */
async function _upsertUsuario({ canal, user_id, nombre, username }) {
  const { rows } = await usuarioRepo.findByCanal(canal, user_id);
  if (rows.length > 0) {
    const stored = rows[0];
    // Si el nombre guardado ya es real, preservarlo. Solo actualizar si era un ID crudo.
    const nombreFinal = !_esNombreCrudo(stored.nombre) ? stored.nombre : nombre;
    await usuarioRepo.update(stored.id, nombreFinal, username || stored.username, null);
    return stored;
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

    const { respuesta, nuevoEstado, teclado } = resultado;
    await conversacionRepo.updateEstado(conversacion.id, nuevoEstado);
    if (respuesta) await mensajeRepo.create(conversacion.id, 'bot', respuesta);
    return { texto: respuesta, conversacion_id: conversacion.id, teclado: teclado || null };

  } catch (err) {
    logger.error('[BOT SERVICE] Error en máquina de estados:', {
      estado:          conversacion.estado,
      conversacion_id: conversacion.id,
      error:           err.message,
    });
    const fallback = "Lo sentimos, hubo un error. Escriba 'hola' para reiniciar.";
    await conversacionRepo.updateEstado(conversacion.id, ESTADOS.INICIO);
    await mensajeRepo.create(conversacion.id, 'bot', fallback);
    return { texto: fallback, conversacion_id: conversacion.id };
  }
}

module.exports = { procesar };
