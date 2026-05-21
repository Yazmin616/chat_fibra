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

const { enviarMensajeTelegram, enviarAccionEscribiendo: telegramEscribiendo } = require('./telegram');
const { enviarMensajeMeta, enviarAccionEscribiendoMeta }                       = require('./meta');
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
async function enviarMensaje(canal, external_id, texto, empresa_id) {
  switch (canal) {
    case 'telegram':
      return enviarMensajeTelegram(external_id, texto, empresa_id);
    case 'whatsapp':
    case 'facebook':
    case 'instagram':
      return enviarMensajeMeta(canal, external_id, texto, empresa_id);
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
async function enviarEscribiendo(canal, external_id, empresa_id) {
  switch (canal) {
    case 'telegram':
      return telegramEscribiendo(external_id, empresa_id);
    case 'whatsapp':
    case 'facebook':
    case 'instagram':
      return enviarAccionEscribiendoMeta(canal, external_id, empresa_id);
    default:
      return;
  }
}

module.exports = { enviarMensaje, enviarEscribiendo };
