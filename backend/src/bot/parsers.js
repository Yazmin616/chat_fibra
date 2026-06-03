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
  if (m.includes('1') || m.includes('venta'))                                       return 'Ventas';
  if (m.includes('2') || m.includes('cobran'))                                      return 'Cobranza';
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

/**
 * Interpreta si el cliente es cliente existente o quiere contratar.
 * @param {string} mensaje
 * @returns {'soy_cliente'|'contratar'|null}
 */
function parseTipoCliente(mensaje) {
  const m = norm(mensaje);
  if (m.includes('soy_cliente') || m.includes('cliente') || m === '1') return 'soy_cliente';
  if (m.includes('contratar')   || m.includes('nuevo')   || m === '2') return 'contratar';
  return null;
}

/**
 * Interpreta la opción del menú de autoservicio.
 * @param {string} mensaje
 * @returns {'deuda'|'pago'|'falla'|'comprobante'|'asesor'|'cambiar_servicio'|null}
 */
function parseAutoservicio(mensaje) {
  const m = norm(mensaje);
  if (m === 'consulta_ajena' || m.includes('otra persona') || m.includes('consulta_ajena')) return 'consulta_ajena';
  if (m === 'cambiar_servicio' || m.includes('cambiar') || m.includes('otro servicio'))      return 'cambiar_servicio';
  if (m === 'deuda'        || m.includes('debo')        || m === '1') return 'deuda';
  if (m === 'pago'         || m.includes('pag')         || m === '2') return 'pago';
  if (m === 'falla'        || m.includes('fall')        || m === '3') return 'falla';
  if (m === 'comprobante'  || m.includes('comprob')     || m === '4') return 'comprobante';
  if (m === 'asesor'       || m.includes('asesor')      || m === '5') return 'asesor';
  return null;
}

/**
 * Interpreta la respuesta a "¿Deseas realizar otra consulta?".
 * @param {string} mensaje
 * @returns {'si'|'no'|'cambiar_servicio'|null}
 */
function parseOtraConsulta(mensaje) {
  const m = norm(mensaje);
  if (m === 'cambiar_servicio' || m.includes('cambiar') || m.includes('otro servicio')) return 'cambiar_servicio';
  if (m === 'si' || m === 'sí' || m === 'yes' || m === '1') return 'si';
  if (m === 'no'               || m === '2')                 return 'no';
  return null;
}

/**
 * Interpreta si el cliente confirma que la cuenta encontrada es suya.
 * @param {string} mensaje
 * @returns {'si'|'no'|null}
 */
function parseConfirmarCuenta(mensaje) {
  const m = norm(mensaje);
  if (m === 'si_mia' || m === 'si' || m === 'sí' || m === '1') return 'si';
  if (m === 'no_mia' || m === 'no'               || m === '2') return 'no';
  return null;
}

/**
 * Interpreta la selección de tipo de identificación.
 * @param {string} mensaje
 * @returns {'tel'|'contrato'|'email'|'usuario'|'wifi'|'cedula'|'asesor'|null}
 */
function parseTipoIdentificacion(mensaje) {
  const m = norm(mensaje);
  if (m === 'id_cliente' || m.includes('id_cliente') || m.includes('id cliente')) return 'id_cliente';
  if (m === 'tel'        || m.includes('telefon') || m.includes('teléfon'))        return 'tel';
  if (m === 'contrato'   || m.includes('contrat'))                                 return 'contrato';
  if (m === 'email'      || m.includes('correo')  || m.includes('@'))              return 'email';
  if (m === 'usuario'    || m.includes('usuario'))                                 return 'usuario';
  if (m === 'wifi'       || m.includes('wifi')    || m.includes('red'))            return 'wifi';
  if (m === 'cedula'     || m.includes('cedul'))                                   return 'cedula';
  if (m === 'asesor'     || m.includes('asesor'))                                  return 'asesor';
  return null;
}

/**
 * Interpreta la selección de un servicio por número (1-based).
 * @param {string} mensaje
 * @param {number} total - Cantidad total de servicios disponibles.
 * @returns {number|null} Índice 0-based del servicio seleccionado, o null si inválido.
 */
function parseNumeroServicio(mensaje, total) {
  const num = parseInt(norm(mensaje), 10);
  if (!isNaN(num) && num >= 1 && num <= total) return num - 1;
  return null;
}

module.exports = {
  parseEmpresa,
  parseDepto,
  parsePuntuacion,
  parseTipoCliente,
  parseAutoservicio,
  parseOtraConsulta,
  parseConfirmarCuenta,
  parseTipoIdentificacion,
  parseNumeroServicio,
};
