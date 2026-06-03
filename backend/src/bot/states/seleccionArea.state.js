/**
 * @file seleccionArea.state.js
 * @description Manejador del estado SELECCION_AREA.
 *
 * El cliente elige área (Ventas, Cobranza, Soporte Técnico).
 *   1. Cierra la conversación de menú (estado → CERRADA).
 *   2. Crea una nueva conversación limpia con estado ESPERANDO_AGENTE.
 *   3. Hace earlyReturn para que el adaptador use el nuevo conversacion_id.
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const { parseDepto }   = require('../parsers');
const { ESTADOS }      = require('../constants');
const { AREAS }        = require('../keyboards');

async function handle(mensaje, conversacion) {
  const depto = parseDepto(mensaje);

  if (depto) {
    await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
    const nuevaConvId = (
      await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, depto)
    ).rows[0].id;

    const bannerCRM    = `CLIENTE EN ESPERA — ${depto}`;
    const confirmacion = `✅ Te estamos conectando con el área de *${depto}*.\n\nPuedes escribir tu consulta ahora y nuestro asesor la tendrá lista al atenderte. ¡Gracias por tu paciencia! 🙏`;

    await mensajeRepo.create(nuevaConvId, 'sistema_info', bannerCRM);
    await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);

    return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: depto } };
  }

  return {
    earlyReturn: false,
    respuesta:   '⚠️ Opción no reconocida. Por favor elige un área:',
    nuevoEstado: conversacion.estado,
    teclado:     AREAS,
  };
}

module.exports = { handle };
