/**
 * @file adapters/index.js
 * @description Dispatcher omnicanal: enruta envíos y acciones de escritura
 * al adaptador correcto según el canal de la conversación.
 *
 * Uso en servicios:
 *   const { enviarMensaje, enviarEscribiendo } = require('../adapters');
 *   await enviarMensaje(canal, external_id, texto, empresa_id);
 *
 * Canales soportados actualmente:
 *   telegram  → adapters/telegram.js
 *   whatsapp  → adapters/meta.js
 *   facebook  → adapters/meta.js
 *   instagram → adapters/meta.js
 */

const { enviarMensajeTelegram, enviarAccionEscribiendo: telegramEscribiendo, enviarFotoTelegram, enviarVozTelegram, enviarDocumentoTelegram, enviarReaccionTelegram } = require('./telegram');
const { enviarMensajeMeta, enviarAccionEscribiendoMeta, enviarMediaMeta } = require('./meta');
const logger = require('../config/logger');

/**
 * Envía un mensaje de texto al cliente por el canal correspondiente.
 *
 * @param {string} canal      - 'telegram' | 'whatsapp' | 'facebook' | 'instagram'
 * @param {string} external_id
 * @param {string} texto
 * @param {string} empresa_id
 * @returns {Promise<boolean>}
 */
async function enviarMensaje(canal, external_id, texto, empresa_id, teclado = null) {
  switch (canal) {
    case 'telegram':
      return enviarMensajeTelegram(external_id, texto, empresa_id, teclado);
    case 'whatsapp':
    case 'facebook':
    case 'instagram':
      return enviarMensajeMeta(canal, external_id, texto, empresa_id, teclado);
    default:
      logger.warn(`[ADAPTER] Canal desconocido: "${canal}" — mensaje no enviado.`);
      return false;
  }
}

/**
 * Envía indicador de escritura ("escribiendo...") al cliente.
 * No todos los canales lo soportan; se omite silenciosamente si no aplica.
 *
 * @param {string} canal
 * @param {string} external_id
 * @param {string} empresa_id
 */
async function enviarEscribiendo(canal, external_id, empresa_id, conversacion_id = null) {
  switch (canal) {
    case 'telegram':
      return telegramEscribiendo(external_id, empresa_id);
    case 'whatsapp':
    case 'facebook':
    case 'instagram':
      return enviarAccionEscribiendoMeta(canal, external_id, empresa_id, conversacion_id);
    default:
      return;
  }
}

/**
 * Envía un archivo multimedia al cliente por el canal correspondiente.
 * @param {string} canal
 * @param {string} external_id
 * @param {Buffer} buffer
 * @param {'photo'|'image'|'voice'|'document'} tipo
 * @param {string} caption
 * @param {string} empresa_id
 * @param {string} [filename]   - Nombre de archivo para document/Meta.
 * @param {string} [mimetype]   - MIME type; se infiere del tipo si falta.
 * @returns {Promise<{ok: boolean, file_id?: string|null}>}
 */
async function enviarMedia(canal, external_id, buffer, tipo, caption, empresa_id, filename = '', mimetype = '') {
  if (canal === 'telegram') {
    if (tipo === 'photo' || tipo === 'image') return enviarFotoTelegram(external_id, buffer, caption, empresa_id);
    if (tipo === 'voice')                     return enviarVozTelegram(external_id, buffer, empresa_id);
    if (tipo === 'document')                  return enviarDocumentoTelegram(external_id, buffer, caption, empresa_id, filename);
  }
  if (canal === 'whatsapp' || canal === 'facebook' || canal === 'instagram') {
    const metaTipo = (tipo === 'photo' || tipo === 'image') ? 'image' : 'document';
    return enviarMediaMeta(canal, external_id, buffer, metaTipo, caption, empresa_id, filename, mimetype);
  }
  logger.warn(`[ADAPTER] enviarMedia no soportado para canal="${canal}" tipo="${tipo}"`);
  return { ok: false, file_id: null };
}

async function enviarReaccion(canal, external_id, telegram_msg_id, emoji, empresa_id) {
  if (canal === 'telegram') return enviarReaccionTelegram(external_id, telegram_msg_id, emoji, empresa_id);
  return { ok: false };
}

module.exports = { enviarMensaje, enviarEscribiendo, enviarMedia, enviarReaccion };
