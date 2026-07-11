/**
 * @file dispatcher.js
 * @description Tabla de despacho que mapea cada estado de conversación al handler
 * que lo procesa. Añadir un nuevo estado implica solo agregar una entrada aquí
 * y crear el archivo de estado correspondiente.
 */

const abiertaState        = require('./states/abierta.state');
const seleccionEmpresa    = require('./states/seleccionEmpresa.state');
const menuTipoCliente     = require('./states/menuTipoCliente.state');
const identificacionDatos = require('./states/identificacionDatos.state');
const confirmarCuenta     = require('./states/confirmarCuenta.state');
const seleccionServicio   = require('./states/seleccionServicio.state');
const menuAutoservicio    = require('./states/menuAutoservicio.state');
const otraConsulta        = require('./states/otraConsulta.state');
const seleccionArea       = require('./states/seleccionArea.state');
const esperandoAgente     = require('./states/esperandoAgente.state');
const encuestaState       = require('./states/encuesta.state');
const flowEngine          = require('./flowEngine/flowEngine');

const { ESTADOS } = require('./constants');

/** @type {Record<string, { handle: Function }>} */
const HANDLERS = {
  // ── Motor visual (flujo dibujado en el canvas) ──────────────────────────
  [flowEngine.ESTADO_FLOW]:      flowEngine,

  // ── Estados de inicio ──────────────────────────────────────────────────
  [ESTADOS.INICIO]:               abiertaState,
  [ESTADOS.ABIERTA]:              abiertaState,

  // ── Flujo de identificación ─────────────────────────────────────────────
  [ESTADOS.SELECCION_EMPRESA]:    seleccionEmpresa,
  [ESTADOS.MENU_TIPO_CLIENTE]:    menuTipoCliente,
  [ESTADOS.IDENTIFICACION_DATOS]: identificacionDatos,
  [ESTADOS.CONFIRMAR_CUENTA]:     confirmarCuenta,
  [ESTADOS.SELECCION_SERVICIO]:   seleccionServicio,

  // ── Autoservicio ────────────────────────────────────────────────────────
  [ESTADOS.MENU_AUTOSERVICIO]:    menuAutoservicio,
  [ESTADOS.OTRA_CONSULTA]:        otraConsulta,

  // ── Atención humana (siempre legacy — no se mueven al motor visual) ──────
  [ESTADOS.SELECCION_AREA]:       seleccionArea,
  [ESTADOS.ESPERANDO_AGENTE]:     esperandoAgente,

  // ── Encuesta y cierre ───────────────────────────────────────────────────
  [ESTADOS.ENCUESTA_AGENTE]:      encuestaState,
  [ESTADOS.ENCUESTA_BOT]:         encuestaState,
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

