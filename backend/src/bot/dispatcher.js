/**
 * @file dispatcher.js
 * @description Tabla de despacho que mapea cada estado de conversación al handler
 * que lo procesa. Añadir un nuevo estado implica solo agregar una entrada aquí
 * y crear el archivo de estado correspondiente.
 */

const abiertaState      = require('./states/abierta.state');
const seleccionEmpresa  = require('./states/seleccionEmpresa.state');
const seleccionArea     = require('./states/seleccionArea.state');
const esperandoAgente   = require('./states/esperandoAgente.state');
const encuestaState     = require('./states/encuesta.state');

/** @type {Record<string, { handle: Function }>} */
const HANDLERS = {
  inicio:            abiertaState,
  abierta:           abiertaState,
  SELECCION_EMPRESA: seleccionEmpresa,
  SELECCION_AREA:    seleccionArea,
  ESPERANDO_AGENTE:  esperandoAgente,
  ENCUESTA_AGENTE:   encuestaState,
  ENCUESTA_BOT:      encuestaState,
};

/**
 * Devuelve el handler para el estado indicado, o null si no está registrado.
 * @param {string} estado
 * @returns {{ handle: Function } | null}
 */
function getHandler(estado) {
  return HANDLERS[estado] || null;
}

module.exports = { getHandler };
