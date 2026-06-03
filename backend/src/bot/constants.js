/**
 * @file constants.js
 * @description Constantes centralizadas del bot.
 *
 * Usar siempre ESTADOS.X y DEPARTAMENTOS.X en lugar de strings literales.
 * Así un typo falla en tiempo de carga (undefined), no silenciosamente en runtime.
 */

/** Estados posibles de una conversación. */
const ESTADOS = Object.freeze({
  INICIO:               'inicio',
  ABIERTA:              'abierta',
  SELECCION_EMPRESA:    'SELECCION_EMPRESA',
  MENU_TIPO_CLIENTE:    'MENU_TIPO_CLIENTE',
  IDENTIFICACION_DATOS: 'IDENTIFICACION_DATOS',
  CONFIRMAR_CUENTA:     'CONFIRMAR_CUENTA',
  SELECCION_SERVICIO:   'SELECCION_SERVICIO',
  MENU_AUTOSERVICIO:    'MENU_AUTOSERVICIO',
  OTRA_CONSULTA:        'OTRA_CONSULTA',
  SELECCION_AREA:       'SELECCION_AREA',
  ESPERANDO_AGENTE:     'ESPERANDO_AGENTE',
  ATENDIENDO:           'atendiendo',
  ENCUESTA_AGENTE:      'ENCUESTA_AGENTE',
  ENCUESTA_BOT:         'ENCUESTA_BOT',
  CERRADA:              'cerrada',
});

/** Departamentos de atención humana. */
const DEPARTAMENTOS = Object.freeze({
  VENTAS:   'Ventas',
  COBRANZA: 'Cobranza',
  SOPORTE:  'Soporte Técnico',
});

module.exports = { ESTADOS, DEPARTAMENTOS };
