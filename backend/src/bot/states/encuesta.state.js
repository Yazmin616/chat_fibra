/**
 * @file encuesta.state.js
 * @description Manejador de los estados ENCUESTA_AGENTE y ENCUESTA_BOT.
 *
 * Recibe la puntuación CSAT del cliente, la persiste en `calificaciones`,
 * cierra la conversación y emite nueva_calificacion al dashboard.
 * La respuesta varía según la calificación para mayor personalización.
 */

const calificacionRepo   = require('../../repositories/calificacion.repository');
const { parsePuntuacion } = require('../parsers');
const { ESTADOS }         = require('../constants');

const RESPUESTAS = {
  '5': '¡Muchas gracias por tu calificación! 🌟 Nos alegra mucho saber que tu experiencia fue excelente. ¡Que tengas un gran día!',
  '4': '¡Gracias por tu calificación! 😊 Nos alegra haber podido ayudarte. ¡Que tengas un excelente día!',
  '3': 'Gracias por tu opinión 🙏. Tomaremos nota para seguir mejorando nuestro servicio. ¡Hasta pronto!',
  '2': 'Lamentamos no haber cumplido tus expectativas 😔. Tu comentario es muy valioso y nos ayuda a mejorar. ¡Gracias por respondernos!',
  '1': 'Lamentamos mucho tu mala experiencia 😔. Trabajaremos duro para mejorar. ¡Gracias por respondernos!',
  Desconocida: 'Gracias por tu respuesta. ¡Hasta pronto! 👋',
};

/**
 * @param {string} mensaje
 * @param {object} conversacion
 * @param {object} _usuario
 * @param {import('socket.io').Server|null} io
 * @returns {Promise<{ respuesta: string, nuevoEstado: string }>}
 */
async function handle(mensaje, conversacion, _usuario, io) {
  const tipo       = conversacion.estado === 'ENCUESTA_AGENTE' ? 'agente' : 'bot';
  const puntuacion = parsePuntuacion(mensaje);

  await calificacionRepo.create(conversacion.id, puntuacion, mensaje, tipo);

  if (io) {
    io.to('admin').emit('nueva_calificacion', {
      conversacion_id: conversacion.id,
      empresa_id:      conversacion.empresa_id,
      puntuacion,
    });
  }

  return {
    respuesta:   RESPUESTAS[puntuacion],
    nuevoEstado: ESTADOS.CERRADA,
  };
}

module.exports = { handle };
