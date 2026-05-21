/**
 * @file parsers.js
 * @description Funciones puras que interpretan la opción enviada por el cliente
 * como texto plano y la convierten en un valor tipado del dominio.
 *
 * Aceptan tanto el número del menú ("1", "2", "3") como palabras clave
 * ("ventas", "soporte", "bien", etc.) para mayor naturalidad.
 * Son sin estado y sin efectos secundarios — ideales para testear unitariamente.
 */

/** @param {string} s */
const norm = (s) => s.trim().toLowerCase();

/**
 * Interpreta la elección de empresa del cliente.
 * @param {string} mensaje
 * @returns {{ empresa: string, nombre: string } | {}}
 */
function parseEmpresa(mensaje) {
  const m = norm(mensaje);
  if (m.includes('1') || m.includes('fibratec'))   return { empresa: 'fibratec',   nombre: 'Fibratec' };
  if (m.includes('2') || m.includes('compus'))     return { empresa: 'compusemmm', nombre: 'Compusemmm de México' };
  return {};
}

/**
 * Interpreta la elección de departamento del cliente.
 * Acepta números (1/2/3) y palabras clave (ventas, cobranza, soporte).
 * @param {string} mensaje
 * @returns {string|null} Nombre del departamento o null si la opción no es válida.
 */
function parseDepto(mensaje) {
  const m = norm(mensaje);
  if (m.includes('1') || m.includes('venta'))               return 'Ventas';
  if (m.includes('2') || m.includes('cobran'))              return 'Cobranza';
  if (m.includes('3') || m.includes('soporte') || m.includes('tecnic') || m.includes('técnic')) return 'Soporte Técnico';
  return null;
}

/**
 * Interpreta la puntuación CSAT enviada por el cliente.
 * Acepta números (1/2/3) y palabras (mal, regular, bien).
 * @param {string} mensaje
 * @returns {'Mal'|'Regular'|'Bien'|'Desconocida'}
 */
function parsePuntuacion(mensaje) {
  const m = norm(mensaje);
  if (m.includes('1') || m === 'mal')      return 'Mal';
  if (m.includes('2') || m === 'regular')  return 'Regular';
  if (m.includes('3') || m === 'bien')     return 'Bien';
  return 'Desconocida';
}

module.exports = { parseEmpresa, parseDepto, parsePuntuacion };
