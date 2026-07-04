/**
 * @file keyboards.js
 * @description Funciones para generar teclados dinámicos con textos personalizados.
 */

const menusService = require('../services/menus.service');

/**
 * Obtiene un teclado base desde la BD.
 */
async function get(menuId, empresaId, columns = 1) {
  return await menusService.getKeyboard(menuId, empresaId, columns);
}

const EMPRESAS = {
  inline_keyboard: [
    [{ text: '1️⃣  Fibratec', callback_data: '1' }],
    [{ text: '2️⃣  Compusemmm de México', callback_data: '2' }],
  ],
};

/**
 * Genera un teclado dinámico con los servicios del cliente.
 */
function generarTecladoServicios(servicios) {
  return {
    inline_keyboard: [
      ...servicios.map((s, i) => [
        { text: `${i + 1}️⃣  ${s.etiqueta}`, callback_data: String(i + 1) },
      ]),
      [{ text: '👥 Consultar para otra persona', callback_data: 'consulta_ajena' }],
    ],
  };
}

/**
 * Devuelve el teclado de autoservicio correcto según el contexto del cliente.
 */
async function getAutoservicioKeyboard(meta, empresaId) {
  const isWisp = meta.identificado_via_wisp;
  const menuId = isWisp ? 'AUTOSERVICIO' : 'AUTOSERVICIO_BASICO';
  
  const base = await get(menuId, empresaId);
  const multi = (meta.cliente?.servicios?.length || 0) > 1;

  if (!multi) return base;

  return {
    inline_keyboard: [
      ...base.inline_keyboard,
      [{ text: '🔄 Cambiar servicio', callback_data: 'cambiar_servicio' }],
    ],
  };
}

/**
 * Devuelve el teclado de "¿Otra consulta?" con o sin opción de cambio de servicio.
 */
async function getOtraConsultaKeyboard(meta, empresaId) {
  const menuId = (meta.cliente?.servicios?.length || 0) > 1 ? 'OTRA_CONSULTA_MULTI' : 'OTRA_CONSULTA';
  return await get(menuId, empresaId);
}

/**
 * Genera un teclado con las intenciones ambiguas detectadas por el NLU.
 */
function generarTecladoAmbiguo(intenciones) {
  const LABELS = {
    soporte:  '🔧 Soporte Técnico',
    cobranza: '💰 Cobranza',
    ventas:   '🛒 Ventas',
    asesor:   '🧑‍💼 Hablar con un asesor',
  };
  return {
    inline_keyboard: intenciones.map(i => [
      { text: LABELS[i.intencion] || i.intencion, callback_data: `intencion:${i.intencion}` },
    ]),
  };
}

module.exports = {
  get,
  EMPRESAS,
  generarTecladoServicios,
  generarTecladoAmbiguo,
  getAutoservicioKeyboard,
  getOtraConsultaKeyboard,
};
