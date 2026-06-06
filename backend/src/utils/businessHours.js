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

/**
 * Calcula cuántos minutos LABORALES han transcurrido entre dos timestamps,
 * contando únicamente los minutos que caen dentro de la jornada configurada.
 *
 * Ejemplo: cliente escribe a las 17:55, jornada 09:00-18:00.
 *   → 5 min laborales el día 1 (17:55-18:00).
 *   → Si el límite es 30 min, la infracción se dispara a las 09:25 del día siguiente
 *     (9:00 + 25 min restantes).
 *
 * @param {Date|string} from  - Inicio del período (cuando el cliente escribió).
 * @param {Date|string} to    - Fin del período (normalmente NOW).
 * @param {{ inicio: string, fin: string, dias: number[] }} jornada
 * @returns {number} Minutos laborales transcurridos (puede ser fraccionario).
 */
function minutosLaboralesElapsados(from, to, jornada) {
  const [startH, startM] = jornada.inicio.split(':').map(Number);
  const [endH, endM]     = jornada.fin.split(':').map(Number);
  const workStartMin = startH * 60 + startM;
  const workEndMin   = endH   * 60 + endM;
  const workDays     = new Set(jornada.dias);

  let total  = 0;
  let cursor = new Date(from);
  const target = new Date(to);

  // Iteramos día a día; cap de 400 días para evitar bucles infinitos en datos erróneos
  let iters = 0;
  while (cursor < target && iters++ < 400) {
    if (!workDays.has(cursor.getDay())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const dayStart = new Date(cursor);
    dayStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(endH, endM, 0, 0);

    const periodStart = cursor   > dayStart ? cursor  : dayStart;
    const periodEnd   = target   < dayEnd   ? target  : dayEnd;

    if (periodEnd > periodStart) {
      total += (periodEnd - periodStart) / 60_000;
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return total;
}

module.exports = { parseJornada, esDentroJornada, horasRealesDesde, minutosLaboralesElapsados };
