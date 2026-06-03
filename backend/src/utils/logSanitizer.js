/**
 * @file logSanitizer.js
 * @description Utilitario para evitar que datos personales lleguen a los logs.
 *
 * Uso:
 *   const { sanitize } = require('../utils/logSanitizer');
 *   logger.error('Error procesando input', sanitize(input));
 */

/** Campos que nunca deben aparecer completos en los logs. */
const CAMPOS_SENSIBLES = new Set([
  'mensaje', 'texto', 'mensaje_display',   // Contenido de mensajes del usuario
  'nombre', 'username',                     // Identidad
  'external_id', 'user_id',                // IDs de canal
  'password', 'token', 'access_token',     // Credenciales
  'telefono', 'email', 'cedula',           // Datos de contacto
]);

/**
 * Retorna una copia del objeto con los campos sensibles reemplazados por '[redactado]'.
 * No mutua el objeto original. Solo procesa el primer nivel (no recursivo).
 *
 * @param {object} obj
 * @returns {object}
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = CAMPOS_SENSIBLES.has(key) ? '[redactado]' : value;
  }
  return result;
}

module.exports = { sanitize };
