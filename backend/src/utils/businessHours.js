/**
 * @file businessHours.js
 * @description Utilidades para calcular tiempo real transcurrido y verificar
 * si un momento cae dentro de la jornada laboral configurada.
 *
 * Formato de jornada:
 *   inicio / fin → "HH:MM"
 *   dias        → "1,2,3,4,5"  (valores de Date.getDay(): 0=Dom, 1=Lun … 6=Sáb)
 */

/**
 * Construye un objeto jornada desde el mapa de configuraciones de la empresa.
 * @param {object} config - Objeto clave-valor de configuraciones
 * @returns {{ inicio: string, fin: string, dias: number[] }}
 */
function parseJornada(config) {
  return {
    inicio: config.jornada_inicio || '09:00',
    fin:    config.jornada_fin    || '18:00',
    dias:   (config.jornada_dias  || '1,2,3,4,5').split(',').map(Number),
  };
}

/**
 * Devuelve true si el momento dado cae dentro de la jornada laboral.
 * @param {Date}   fecha
 * @param {{ inicio: string, fin: string, dias: number[] }} jornada
 */
function esDentroJornada(fecha, jornada) {
  const dia = fecha.getDay();
  if (!jornada.dias.includes(dia)) return false;
  const [hI, mI] = jornada.inicio.split(':').map(Number);
  const [hF, mF] = jornada.fin.split(':').map(Number);
  const minutos  = fecha.getHours() * 60 + fecha.getMinutes();
  return minutos >= (hI * 60 + mI) && minutos < (hF * 60 + mF);
}

/**
 * Devuelve las horas reales transcurridas desde una fecha hasta ahora.
 * @param {Date|string} fecha
 * @returns {number}
 */
function horasRealesDesde(fecha) {
  return (Date.now() - new Date(fecha).getTime()) / 3_600_000;
}

module.exports = { parseJornada, esDentroJornada, horasRealesDesde };
