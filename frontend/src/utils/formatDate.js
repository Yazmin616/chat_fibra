/**
 * @file formatDate.js
 * @description Utilidades de formato de fecha/hora para el CRM.
 *
 * Lógica de negocio:
 *   - Hoy          → "14:32"
 *   - Ayer         → "Ayer"
 *   - Esta semana  → "Lunes", "Martes" …
 *   - Este año     → "12 may."
 *   - Año anterior → "12 may. 2024"
 *
 * Separadores de día en el chat:
 *   - Hoy          → "Hoy"
 *   - Ayer         → "Ayer"
 *   - Esta semana  → "Lunes 12 de mayo"
 *   - Este año     → "12 de mayo"
 *   - Año anterior → "12 de mayo de 2024"
 */

const LOCALE = 'es-MX';

/** Devuelve true si dos fechas caen en el mismo día calendario. */
export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth()    === db.getMonth()    &&
    da.getDate()     === db.getDate()
  );
}

/** Capitaliza la primera letra de un string. */
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formatea la marca de tiempo para la lista de conversaciones (columna derecha).
 *
 * Ejemplos:
 *   Hoy          → "14:32"
 *   Ayer         → "Ayer"
 *   Hace 3 días  → "Lunes"
 *   Hace 8 días  → "12 may."
 *   Año pasado   → "12 may. 2024"
 *
 * @param {string|Date} date
 * @returns {string}
 */
export function formatConvTime(date) {
  if (!date) return '';
  const d   = new Date(date);
  const now = new Date();

  if (isNaN(d.getTime())) return '';

  if (isSameDay(d, now)) {
    return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const ayer = new Date(now);
  ayer.setDate(ayer.getDate() - 1);
  if (isSameDay(d, ayer)) return 'Ayer';

  const diffMs   = now - d;
  const diffDias = Math.floor(diffMs / 86_400_000);
  if (diffDias < 7) {
    return cap(d.toLocaleDateString(LOCALE, { weekday: 'long' }));
  }

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  }

  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Formatea la hora dentro de una burbuja de mensaje (siempre HH:MM).
 *
 * @param {string|Date} date
 * @returns {string}
 */
export function formatMsgTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Texto para el separador de día que aparece entre mensajes de distintos días.
 *
 * Ejemplos:
 *   Hoy          → "Hoy"
 *   Ayer         → "Ayer"
 *   Esta semana  → "Lunes 12 de mayo"
 *   Este año     → "12 de mayo"
 *   Año anterior → "12 de mayo de 2024"
 *
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDaySeparator(date) {
  if (!date) return '';
  const d   = new Date(date);
  const now = new Date();

  if (isNaN(d.getTime())) return '';

  if (isSameDay(d, now)) return 'Hoy';

  const ayer = new Date(now);
  ayer.setDate(ayer.getDate() - 1);
  if (isSameDay(d, ayer)) return 'Ayer';

  const diffDias = Math.floor((now - d) / 86_400_000);
  if (diffDias < 7) {
    return cap(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  if (d.getFullYear() === now.getFullYear()) {
    return cap(d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' }));
  }

  return cap(d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }));
}
