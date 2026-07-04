/**
 * @file otraConsulta.state.js
 * @description Manejador del estado OTRA_CONSULTA.
 *
 *   Sí               → MENU_AUTOSERVICIO (mismo servicio)
 *   No               → ENCUESTA_BOT
 *   Cambiar servicio → SELECCION_SERVICIO (solo si multi-servicio)
 */

const { parseOtraConsulta } = require('../parsers');
const { ESTADOS }           = require('../constants');
const { ConversacionMeta }  = require('../conversacion.meta');
const keyboards = require('../keyboards');

async function handle(mensaje, conversacion) {
  const respuesta = parseOtraConsulta(mensaje);
  const meta      = new ConversacionMeta(conversacion.metadata);

  if (respuesta === 'cambiar_servicio' && meta.esMultiServicio) {
    const listaTexto = meta.cliente.servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
    return {
      respuesta:   `🔄 ¿Cuál servicio deseas consultar?\n\n${listaTexto}`,
      nuevoEstado: ESTADOS.SELECCION_SERVICIO,
      teclado:     keyboards.generarTecladoServicios(meta.cliente.servicios),
    };
  }

  if (respuesta === 'si') {
    return {
      respuesta:   '¿En qué más puedo ayudarte?',
      nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
      teclado:     await keyboards.getAutoservicioKeyboard(meta.toJSON(), conversacion.empresa_id),
    };
  }

  if (respuesta === 'no') {
    return {
      respuesta:   '¡Gracias por contactarnos! 😊\n\n¿Cómo calificarías la atención recibida hoy?',
      nuevoEstado: ESTADOS.ENCUESTA_BOT,
      teclado: await keyboards.get('ENCUESTA', conversacion.empresa_id),
    };
  }

  return {
    respuesta:   '⚠️ Por favor selecciona una opción:',
    nuevoEstado: conversacion.estado,
    teclado:     await keyboards.getOtraConsultaKeyboard(meta.toJSON(), conversacion.empresa_id),
  };
}

module.exports = { handle };
