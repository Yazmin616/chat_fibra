/**
 * @file confirmarCuenta.state.js
 * @description Manejador del estado CONFIRMAR_CUENTA.
 *
 *   "Sí, es mi cuenta"         → guarda datos WISP en el perfil (reconocimiento automático)
 *                                 → SELECCION_SERVICIO / MENU_AUTOSERVICIO
 *   "No, consulto por alguien" → NO guarda nada permanente → misma navegación
 */

const conversacionRepo         = require('../../repositories/conversacion.repository');
const usuarioRepo              = require('../../repositories/usuario.repository');
const { parseConfirmarCuenta } = require('../parsers');
const { ESTADOS }              = require('../constants');
const { ConversacionMeta }     = require('../conversacion.meta');

const {
  CONFIRMAR_CUENTA,
  AUTOSERVICIO,
  AUTOSERVICIO_BASICO,
  generarTecladoServicios,
} = require('../keyboards');

async function handle(mensaje, conversacion, usuario) {
  const respuesta = parseConfirmarCuenta(mensaje);
  const meta      = new ConversacionMeta(conversacion.metadata);

  if (!respuesta) {
    return {
      respuesta:   '⚠️ Por favor selecciona una opción:',
      nuevoEstado: conversacion.estado,
      teclado:     CONFIRMAR_CUENTA,
    };
  }

  if (!meta.cliente) {
    return {
      respuesta:   '⚠️ Sesión expirada. Por favor escribe *hola* para reiniciar.',
      nuevoEstado: ESTADOS.INICIO,
    };
  }

  if (respuesta === 'si') {
    await usuarioRepo.updateWispData(conversacion.usuario_id, meta.cliente);
    // Actualizar nombre visible en el CRM con el nombre real del WISP
    await usuarioRepo.update(
      conversacion.usuario_id,
      meta.cliente.nombre,
      usuario?.username || '',
      null                      // COALESCE — no toca teléfono existente
    );
    await conversacionRepo.updateMetadata(conversacion.id, { ...meta.toJSON(), identificado_via_wisp: true });
  }

  const nombre = meta.cliente.nombre.split(' ')[0];
  const saludo = respuesta === 'si'
    ? `✅ Perfecto, *${nombre}*. En futuras visitas te reconoceremos automáticamente.`
    : `👍 Entendido. Esta consulta queda registrada solo para esta sesión.`;

  if (meta.esMultiServicio) {
    const listaTexto = meta.cliente.servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
    return {
      respuesta:   `${saludo}\n\nTienes varios servicios registrados. ¿Cuál deseas consultar?\n\n${listaTexto}`,
      nuevoEstado: ESTADOS.SELECCION_SERVICIO,
      teclado:     generarTecladoServicios(meta.cliente.servicios),
    };
  }

  const teclado = meta.identificado_via_wisp ? AUTOSERVICIO : AUTOSERVICIO_BASICO;
  return {
    respuesta:   `${saludo}\n\n¿En qué puedo ayudarte hoy?`,
    nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
    teclado,
  };
}

module.exports = { handle };
