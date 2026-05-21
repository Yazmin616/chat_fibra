/**
 * @file seleccionEmpresa.state.js
 * @description Manejador del estado SELECCION_EMPRESA.
 *
 * El cliente debe responder "1" (Fibratec) o "2" (Compusemmm).
 * Al confirmar, actualiza empresa_id y muestra el menú de áreas.
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const { parseEmpresa } = require('../parsers');

const MENU_AREAS = `1️⃣  Ventas — Planes, promociones y contrataciones
2️⃣  Cobranza — Pagos, facturas y estados de cuenta
3️⃣  Soporte Técnico — Fallas, velocidad y configuración

Escribe el número de tu elección.`;

/**
 * @param {string} mensaje
 * @param {object} conversacion
 * @returns {Promise<{ respuesta: string, nuevoEstado: string }>}
 */
async function handle(mensaje, conversacion) {
  const { empresa, nombre } = parseEmpresa(mensaje);

  if (empresa) {
    await conversacionRepo.updateEmpresa(conversacion.id, empresa);
    return {
      respuesta:   `✅ Has seleccionado ${nombre}.\n\n¿Con qué área podemos ayudarte?\n\n${MENU_AREAS}`,
      nuevoEstado: 'SELECCION_AREA',
    };
  }

  return {
    respuesta:   `⚠️ Opción no reconocida. Por favor responde con:\n\n1️⃣  Fibratec\n2️⃣  Compusemmm de México`,
    nuevoEstado: conversacion.estado,
  };
}

module.exports = { handle };
