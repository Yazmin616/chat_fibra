/**
 * @file turnosHorarios.js
 * @description Motor de horarios por área con turnos múltiples y calendario de festivos.
 *
 * Jerarquía de fallback al cargar turnos:
 *   1. Turnos activos del área específica
 *   2. Turnos globales activos (area IS NULL)
 *   3. Jornada global de `configuraciones` (jornada_inicio/fin/dias)
 *
 * ZONA HORARIA: todos los cálculos de día/hora se hacen en la timezone local del
 * negocio (configMap.tz o TZ_DEFAULT). Nunca se comparan horas UTC contra turnos
 * definidos en hora local.
 */

const TZ_DEFAULT   = 'America/Mexico_City';
const DIAS_NOMBRE  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGA   = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Intl 'short' weekday en en-US → índice JS (0=Dom … 6=Sáb)
const WEEKDAY_IDX  = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ── Helper de zona horaria ───────────────────────────────────────────────────

/**
 * Extrae día de la semana, hora y minuto de `fecha` en la timezone dada.
 * Usa Intl.DateTimeFormat — no depende de la TZ del servidor.
 *
 * @param {Date}   fecha
 * @param {string} tz   - Ej. 'America/Mexico_City'
 * @returns {{ dia: number, hora: number, minuto: number, day: number, month: number, year: number }}
 */
function _localParts(fecha, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || TZ_DEFAULT,
    weekday:  'short',
    year:     'numeric',
    month:    'numeric',
    day:      'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  });
  const p = Object.fromEntries(fmt.formatToParts(fecha).map(x => [x.type, x.value]));
  // Algunos entornos devuelven '24' para medianoche en lugar de '00'
  const hora = (p.hour === '24') ? 0 : parseInt(p.hour, 10);
  return {
    dia:    WEEKDAY_IDX[p.weekday] ?? fecha.getDay(),
    hora,
    minuto: parseInt(p.minute, 10),
    day:    parseInt(p.day,   10),
    month:  parseInt(p.month, 10) - 1,   // 0-indexed
    year:   parseInt(p.year,  10),
  };
}

/**
 * Devuelve la fecha local en formato "YYYY-MM-DD" en la timezone dada.
 * Se usa para comparar contra la columna DATE de la tabla `festivos`.
 */
function _localDateStr(fecha, tz) {
  return new Intl.DateTimeFormat('en-CA', {   // 'en-CA' produce YYYY-MM-DD
    timeZone: tz || TZ_DEFAULT,
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).format(fecha);
}

/**
 * Timestamp UTC correspondiente a la medianoche LOCAL del día de `fecha`.
 * Nota: para la mayoría de zonas horarias modernas el offset es múltiplo de minutos,
 * por lo que los segundos/ms del objeto Date no cambian entre zonas.
 */
function _localMidnightUTC(fecha, tz) {
  const p        = _localParts(fecha, tz);
  const msInDay  = p.hora * 3_600_000 + p.minuto * 60_000
    + fecha.getSeconds() * 1_000 + fecha.getMilliseconds();
  return new Date(fecha.getTime() - msInDay);
}

// ── Carga ────────────────────────────────────────────────────────────────────

/**
 * Carga los turnos activos para (empresaId, area) con la jerarquía de fallback.
 */
async function cargarTurnos(db, empresaId, area, configMap = {}) {
  if (area) {
    const { rows } = await db.query(
      `SELECT * FROM turnos WHERE empresa_id=$1 AND area=$2 AND activo=true ORDER BY hora_inicio`,
      [empresaId, area]
    );
    if (rows.length > 0) return rows;
  }

  {
    const { rows } = await db.query(
      `SELECT * FROM turnos WHERE empresa_id=$1 AND area IS NULL AND activo=true ORDER BY hora_inicio`,
      [empresaId]
    );
    if (rows.length > 0) return rows;
  }

  // Fallback: jornada global de configuraciones
  return [{
    id:          0,
    empresa_id:  empresaId,
    area:        null,
    nombre:      'Jornada global',
    hora_inicio: configMap.jornada_inicio || '09:00',
    hora_fin:    configMap.jornada_fin    || '18:00',
    dias:        configMap.jornada_dias   || '1,2,3,4,5',
    activo:      true,
  }];
}

// ── Comprobaciones ───────────────────────────────────────────────────────────

/**
 * Devuelve true si `fecha` cae dentro de algún turno del array.
 * Evalúa en la timezone local del negocio (no en UTC del servidor).
 *
 * @param {Date}     fecha
 * @param {object[]} turnos
 * @param {string}   tz
 */
function esTurnoActivo(fecha, turnos, tz) {
  const { dia, hora, minuto } = _localParts(fecha, tz || TZ_DEFAULT);
  const minutos = hora * 60 + minuto;

  return turnos.some(t => {
    const diasTurno = new Set(t.dias.split(',').map(Number));
    if (!diasTurno.has(dia)) return false;
    const [hI, mI] = t.hora_inicio.split(':').map(Number);
    const [hF, mF] = t.hora_fin.split(':').map(Number);
    return minutos >= hI * 60 + mI && minutos < hF * 60 + mF;
  });
}

/**
 * Devuelve true si `fecha` es festivo para (empresaId, area).
 * Compara contra la fecha LOCAL del negocio.
 *
 * @param {object}      db
 * @param {Date}        fecha
 * @param {string}      empresaId
 * @param {string|null} area
 * @param {string}      [tz]
 */
async function esFestivo(db, fecha, empresaId, area, tz) {
  const fechaStr = _localDateStr(fecha, tz || TZ_DEFAULT);
  const { rows } = await db.query(
    `SELECT 1 FROM festivos
     WHERE empresa_id=$1 AND fecha=$2 AND (area IS NULL OR area=$3)
     LIMIT 1`,
    [empresaId, fechaStr, area || null]
  );
  return rows.length > 0;
}

// ── Detección de escenario ───────────────────────────────────────────────────

/**
 * Detecta el escenario al recibir un mensaje del cliente.
 *
 * A = día festivo     → aviso + sin sanciones
 * B = fuera de turno  → aviso + sin sanciones
 * C = turno activo    → flujo normal + sanciones
 *
 * La zona horaria se toma de configMap.tz (default TZ_DEFAULT).
 *
 * @returns {Promise<{ escenario: 'A'|'B'|'C', turnos: object[] }>}
 */
async function detectarEscenario(db, fecha, empresaId, area, configMap = {}) {
  const tz     = configMap.tz || TZ_DEFAULT;
  const turnos = await cargarTurnos(db, empresaId, area, configMap);

  if (await esFestivo(db, fecha, empresaId, area, tz)) {
    return { escenario: 'A', turnos };
  }

  if (esTurnoActivo(fecha, turnos, tz)) {
    return { escenario: 'C', turnos };
  }

  return { escenario: 'B', turnos };
}

// ── Cálculo de minutos laborales con turnos múltiples ────────────────────────

/**
 * Calcula cuántos minutos laborales han transcurrido entre `from` y `to`,
 * respetando los múltiples turnos y la timezone local del negocio.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @param {object[]}    turnos
 * @param {string}      [tz]
 * @returns {number}
 */
function minutosLaboralesTurnos(from, to, turnos, tz) {
  if (!turnos || turnos.length === 0) return 0;
  const tzStr = tz || TZ_DEFAULT;

  const turnosParsed = turnos.map(t => ({
    dias:     new Set(t.dias.split(',').map(Number)),
    startMin: parseInt(t.hora_inicio.split(':')[0]) * 60 + parseInt(t.hora_inicio.split(':')[1]),
    endMin:   parseInt(t.hora_fin.split(':')[0])   * 60 + parseInt(t.hora_fin.split(':')[1]),
  }));

  let total  = 0;
  let cursor = new Date(from);
  const target = new Date(to);

  let iters = 0;
  while (cursor < target && iters++ < 400) {
    const parts       = _localParts(cursor, tzStr);
    const midnight    = _localMidnightUTC(cursor, tzStr);
    const turnosDia   = turnosParsed.filter(t => t.dias.has(parts.dia));

    for (const t of turnosDia) {
      // dayStart/dayEnd son timestamps UTC construidos desde medianoche local + minutos del turno
      const dayStart = new Date(midnight.getTime() + t.startMin * 60_000);
      const dayEnd   = new Date(midnight.getTime() + t.endMin   * 60_000);

      const periodStart = cursor > dayStart ? cursor  : dayStart;
      const periodEnd   = target < dayEnd   ? target  : dayEnd;

      if (periodEnd > periodStart) {
        total += (periodEnd - periodStart) / 60_000;
      }
    }

    // Avanzar al inicio del siguiente día local (~24 h + snap a medianoche local)
    const nextApprox = new Date(cursor.getTime() + 24 * 3_600_000);
    cursor = _localMidnightUTC(nextApprox, tzStr);
  }

  return total;
}

// ── Formateo de horarios para mensajes ──────────────────────────────────────

/**
 * Genera texto legible de los horarios desde los turnos.
 * Ej: "Lun-Vie 9am-6pm, Lun-Vie 6pm-11pm, Sáb 9am-8pm"
 * Se inyecta como {horarios_atencion} en los mensajes automáticos.
 *
 * @param {object[]} turnos
 * @returns {string}
 */
function formatearHorarios(turnos) {
  const activos = (turnos || []).filter(t => t.activo !== false);
  if (activos.length === 0) return 'Sin horario configurado';

  const ordLaboral = [1, 2, 3, 4, 5, 6, 0];
  const ordenar    = dias => [...dias].sort((a, b) => ordLaboral.indexOf(a) - ordLaboral.indexOf(b));

  // Agrupar por franja horaria (mismo inicio + mismo fin)
  const porFranja = {};
  for (const t of activos) {
    const key = `${t.hora_inicio}|${t.hora_fin}`;
    if (!porFranja[key]) porFranja[key] = { inicio: t.hora_inicio, fin: t.hora_fin, dias: new Set() };
    t.dias.split(',').map(Number).forEach(d => porFranja[key].dias.add(d));
  }

  return Object.values(porFranja)
    .map(g => {
      const dias    = ordenar(g.dias);
      return `${_comprimirDias(dias)} ${_formatHora(g.inicio)}-${_formatHora(g.fin)}`;
    })
    .join(', ');
}

/**
 * Calcula el próximo día hábil (con turno activo y sin festivo).
 * Busca hasta 14 días hacia adelante en la timezone local.
 *
 * @param {object}      db
 * @param {string}      empresaId
 * @param {string|null} area
 * @param {object}      configMap
 * @returns {Promise<string>}  Ej. "lunes 9/6"
 */
async function proximoDiaHabil(db, empresaId, area, configMap = {}) {
  const tz     = configMap.tz || TZ_DEFAULT;
  const turnos = await cargarTurnos(db, empresaId, area, configMap);
  const diasConTurno = new Set();
  turnos.forEach(t => t.dias.split(',').map(Number).forEach(d => diasConTurno.add(d)));

  // Empezar desde mañana (medianoche local)
  let cursor = _localMidnightUTC(new Date(Date.now() + 24 * 3_600_000), tz);

  for (let i = 0; i < 14; i++) {
    const parts = _localParts(cursor, tz);
    if (diasConTurno.has(parts.dia)) {
      const festivo = await esFestivo(db, cursor, empresaId, area, tz);
      if (!festivo) {
        return `${DIAS_LARGA[parts.dia]} ${parts.day}/${parts.month + 1}`;
      }
    }
    cursor = _localMidnightUTC(new Date(cursor.getTime() + 24 * 3_600_000), tz);
  }

  return 'el próximo día hábil';
}

// ── Helpers privados ─────────────────────────────────────────────────────────

function _formatHora(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function _comprimirDias(dias) {
  if (dias.length === 0) return '';
  if (dias.length === 1) return DIAS_NOMBRE[dias[0]];
  const ordLaboral  = [1, 2, 3, 4, 5, 6, 0];
  const indices     = dias.map(d => ordLaboral.indexOf(d));
  const consecutivo = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
  if (consecutivo && dias.length >= 3) {
    return `${DIAS_NOMBRE[dias[0]]}-${DIAS_NOMBRE[dias[dias.length - 1]]}`;
  }
  return dias.map(d => DIAS_NOMBRE[d]).join(', ');
}

module.exports = {
  cargarTurnos,
  esTurnoActivo,
  esFestivo,
  detectarEscenario,
  minutosLaboralesTurnos,
  formatearHorarios,
  proximoDiaHabil,
  TZ_DEFAULT,
};
