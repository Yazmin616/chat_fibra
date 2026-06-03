/**
 * @file seleccionServicio.state.js
 * @description Manejador del estado SELECCION_SERVICIO.
 *
 * Se muestra cuando el cliente tiene más de un servicio registrado.
 * Guarda el índice del servicio seleccionado en metadata y va a MENU_AUTOSERVICIO.
 */

const conversacionRepo  = require('../../repositories/conversacion.repository');
const { parseNumeroServicio, parseAutoservicio } = require('../parsers');
const { ESTADOS }       = require('../constants');
const { ConversacionMeta } = require('../conversacion.meta');
const {
  AUTOSERVICIO,
  AUTOSERVICIO_BASICO,
  TIPO_IDENTIFICACION,
  generarTecladoServicios,
} = require('../keyboards');

async function handle(mensaje, conversacion) {
  const meta     = new ConversacionMeta(conversacion.metadata);
  const servicios = meta.cliente?.servicios || [];

  if (!servicios.length) {
    return {
      respuesta:   '⚠️ No se encontraron servicios. Por favor escribe *asesor* para recibir ayuda.',
      nuevoEstado: conversacion.estado,
    };
  }

  if (parseAutoservicio(mensaje) === 'consulta_ajena') {
    await conversacionRepo.updateMetadata(conversacion.id, {
      ...meta.toJSON(),
      consulta_ajena:      true,
      tipo_identificacion: null,
    });
    return {
      respuesta:   '👥 De acuerdo. ¿Con qué dato identifico a la persona?',
      nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
      teclado:     TIPO_IDENTIFICACION,
    };
  }

  const idx = parseNumeroServicio(mensaje, servicios.length);

  if (idx === null) {
    const listaTexto = servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
    return {
      respuesta:   `⚠️ Opción no reconocida. Por favor selecciona un servicio:\n\n${listaTexto}`,
      nuevoEstado: conversacion.estado,
      teclado:     generarTecladoServicios(servicios),
    };
  }

  await conversacionRepo.updateMetadata(conversacion.id, { ...meta.toJSON(), servicio_idx: idx });

  const servicio = servicios[idx];
  const teclado  = meta.identificado_via_wisp ? AUTOSERVICIO : AUTOSERVICIO_BASICO;

  return {
    respuesta:   `📋 Servicio seleccionado: *${servicio.etiqueta}*\n\n¿En qué puedo ayudarte?`,
    nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
    teclado,
  };
}

module.exports = { handle };
