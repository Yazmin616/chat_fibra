/**
 * @file calificacion.repository.js
 * @description Capa de acceso a datos para la tabla `calificaciones`.
 *
 * Las calificaciones son las respuestas CSAT (Customer Satisfaction) que el cliente
 * envía al finalizar un chat. El cliente responde 1, 2 o 3 en Telegram:
 *   1 → "Mal"
 *   2 → "Regular"
 *   3 → "Bien"
 *
 * Cada calificación se asocia a una conversación y tiene un tipo:
 *   - "agente" → el chat fue atendido por un humano.
 *   - "bot"    → el chat fue atendido únicamente por el bot (o cerrado por inactividad).
 */

const db = require('../config/db');

/**
 * Registra la calificación de satisfacción enviada por el cliente.
 * @param {number} conversacion_id - PK de la conversación calificada.
 * @param {string} puntuacion      - "Bien", "Regular" o "Mal".
 * @param {string} sugerencia      - Texto completo del mensaje enviado por el cliente.
 * @param {string} tipo            - "agente" o "bot".
 * @returns {Promise<import('pg').QueryResult>}
 */
const create = (conversacion_id, puntuacion, sugerencia, tipo) =>
  db.query(
    'INSERT INTO calificaciones (conversacion_id, puntuacion, sugerencia, tipo) VALUES ($1,$2,$3,$4)',
    [conversacion_id, puntuacion, sugerencia, tipo]
  );

/**
 * Elimina todas las calificaciones de una lista de conversaciones (borrado total GDPR).
 * @param {number[]} ids - Array de PKs de conversaciones.
 * @returns {Promise<import('pg').QueryResult>}
 */
const deleteByConversacionIds = (ids) =>
  db.query('DELETE FROM calificaciones WHERE conversacion_id=ANY($1)', [ids]);

module.exports = { create, deleteByConversacionIds };
