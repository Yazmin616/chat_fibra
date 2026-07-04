/**
 * @file bot/nlu/index.js
 * @description Motor de detección de intención por palabras clave.
 *
 * Las reglas se cargan desde la tabla `palabras_clave_bot`, con caché de 5 min.
 * empresa_id específica tiene prioridad sobre '__todas__' (fallback global).
 *
 * Intenciones posibles: 'asesor', 'soporte', 'cobranza', 'ventas'
 *   'asesor'   → el cliente quiere hablar con un humano (cualquier área)
 *   'soporte'  → área de Soporte Técnico
 *   'cobranza' → área de Cobranza
 *   'ventas'   → área de Ventas
 */

const db     = require('../../config/db');
const logger = require('../../config/logger');
const { DEPARTAMENTOS } = require('../constants');

/** Intención → nombre de departamento (null si no mapea a un área concreta) */
const INTENCION_A_DEPTO = {
  soporte:  DEPARTAMENTOS.SOPORTE,
  cobranza: DEPARTAMENTOS.COBRANZA,
  ventas:   DEPARTAMENTOS.VENTAS,
  asesor:   null,
};

// Caché en memoria: empresa_id → { reglas, loadedAt }
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Normaliza texto para comparación: minúsculas, sin acentos, sin puntuación.
 * "¿Sin señal?" → "sin senal"
 */
function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

async function _cargarReglas(empresa_id) {
  const ahora = Date.now();
  const cached = _cache.get(empresa_id);
  if (cached && (ahora - cached.loadedAt) < CACHE_TTL_MS) return cached.reglas;

  try {
    const { rows } = await db.query(
      `SELECT intencion, palabras, empresa_id
       FROM palabras_clave_bot
       WHERE activo = TRUE AND empresa_id IN ('__todas__', $1)
       ORDER BY CASE WHEN empresa_id = $1 THEN 0 ELSE 1 END`,
      [empresa_id]
    );

    // Si la empresa tiene su propia regla para una intención, usa esa; si no, usa __todas__
    const mapa = new Map();
    for (const row of rows) {
      if (!mapa.has(row.intencion)) mapa.set(row.intencion, row.palabras);
    }

    const reglas = Array.from(mapa.entries()).map(([intencion, palabras]) => ({ intencion, palabras }));
    _cache.set(empresa_id, { reglas, loadedAt: ahora });
    return reglas;
  } catch (err) {
    logger.warn('[NLU] No se pudieron cargar reglas de palabras_clave_bot:', err.message);
    return [];
  }
}

/**
 * Detecta si el mensaje coincide con alguna intención (primera coincidencia).
 * @returns {Promise<{intencion: string, palabraCoincide: string, depto: string|null}|null>}
 */
async function detectarIntencion(mensaje, empresa_id) {
  if (!mensaje || typeof mensaje !== 'string') return null;
  const reglas = await _cargarReglas(empresa_id || '__todas__');
  const m = normalizar(mensaje);

  for (const regla of reglas) {
    for (const palabra of regla.palabras) {
      if (m.includes(normalizar(palabra))) {
        return {
          intencion:       regla.intencion,
          palabraCoincide: palabra,
          depto:           INTENCION_A_DEPTO[regla.intencion] ?? null,
        };
      }
    }
  }
  return null;
}

/**
 * Detecta TODAS las intenciones que coinciden con el mensaje.
 * Usa para manejar ambigüedad: si el mensaje activa varias intenciones,
 * se le muestra al cliente un menú con las opciones detectadas.
 * @returns {Promise<Array<{intencion: string, palabraCoincide: string, depto: string|null}>>}
 */
async function detectarTodasCoincidentes(mensaje, empresa_id) {
  if (!mensaje || typeof mensaje !== 'string') return [];
  const reglas = await _cargarReglas(empresa_id || '__todas__');
  const m = normalizar(mensaje);
  const resultados = [];

  for (const regla of reglas) {
    for (const palabra of regla.palabras) {
      if (m.includes(normalizar(palabra))) {
        resultados.push({
          intencion:       regla.intencion,
          palabraCoincide: palabra,
          depto:           INTENCION_A_DEPTO[regla.intencion] ?? null,
        });
        break; // una coincidencia por intención es suficiente
      }
    }
  }
  return resultados;
}

/**
 * Detecta específicamente solicitud de asesor humano.
 * @returns {Promise<{intencion:'asesor', palabraCoincide:string}|null>}
 */
async function esAsesorIntent(mensaje, empresa_id) {
  const r = await detectarIntencion(mensaje, empresa_id);
  return r?.intencion === 'asesor' ? r : null;
}

/**
 * Detecta intención de área específica (soporte/cobranza/ventas).
 * Excluye la intención 'asesor' (genérica).
 * @returns {Promise<{intencion:string, depto:string}|null>}
 */
async function detectarArea(mensaje, empresa_id) {
  const r = await detectarIntencion(mensaje, empresa_id);
  if (!r || r.intencion === 'asesor') return null;
  return r;
}

/**
 * Detecta específicamente palabras de agradecimiento.
 * @returns {Promise<{intencion:'agradecimiento', palabraCoincide:string}|null>}
 */
async function esAgradecimientoIntent(mensaje, empresa_id) {
  const r = await detectarIntencion(mensaje, empresa_id);
  return r?.intencion === 'agradecimiento' ? r : null;
}

/** Invalida el caché (llamar tras modificar palabras_clave_bot). */
function invalidarCache(empresa_id = null) {
  if (empresa_id) {
    _cache.delete(empresa_id);
    _cache.delete('__todas__');
  } else {
    _cache.clear();
  }
}

module.exports = { normalizar, detectarIntencion, detectarTodasCoincidentes, esAsesorIntent, detectarArea, esAgradecimientoIntent, invalidarCache };
