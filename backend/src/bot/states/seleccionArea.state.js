/**
 * @file seleccionArea.state.js
 * @description Manejador del estado SELECCION_AREA.
 *
 * El cliente elige área (1-Ventas, 2-Cobranza, 3-Soporte Técnico).
 * Al confirmar:
 *   1. Cierra la conversación de menú (estado → "cerrada").
 *   2. Crea una nueva conversación limpia con estado ESPERANDO_AGENTE.
 *   3. Registra los mensajes en la nueva conversación.
 *   4. Hace earlyReturn con el texto de confirmación para que Telegram
 *      lo envíe al cliente y el dashboard use el nuevo ID de conversación.
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const { parseDepto }   = require('../parsers');

/**
 * @param {string} mensaje
 * @param {object} conversacion
 * @returns {Promise<
 *   { earlyReturn: true,  resultado: { texto: string, conversacion_id: number } } |
 *   { earlyReturn: false, respuesta: string, nuevoEstado: string }
 * >}
 */
async function handle(mensaje, conversacion) {
  const depto = parseDepto(mensaje);

  if (depto) {
    await conversacionRepo.updateEstado(conversacion.id, 'cerrada');
    const nuevaConvId = (
      await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, depto)
    ).rows[0].id;

    const bannerCRM  = `CLIENTE EN ESPERA — ${depto}`;
    const confirmacion = `✅ Te estamos conectando con el área de *${depto}*.\n\nPuedes escribir tu consulta ahora y nuestro asesor la tendrá lista al atenderte. ¡Gracias por tu paciencia! 🙏`;

    await mensajeRepo.create(nuevaConvId, 'sistema_info', bannerCRM);
    await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);

    return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: depto } };
  }

  return {
    earlyReturn: false,
    respuesta:   `⚠️ Opción no reconocida. Por favor responde con:\n\n1️⃣  Ventas\n2️⃣  Cobranza\n3️⃣  Soporte Técnico`,
    nuevoEstado: conversacion.estado,
  };
}

module.exports = { handle };
