/**
 * @file abierta.state.js
 * @description Manejador del estado inicial ("inicio" / "abierta").
 *
 * Saluda al cliente y decide el siguiente paso:
 *   - Bot genérico (empresaPreconfigurada=false) → SELECCION_EMPRESA
 *   - Bot de empresa (empresaPreconfigurada=true):
 *       · Cliente recurrente reconocido en WISP → SELECCION_SERVICIO / MENU_AUTOSERVICIO
 *       · Cliente recurrente no reconocido       → IDENTIFICACION_DATOS
 *       · Cliente nuevo                          → MENU_TIPO_CLIENTE
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const wisp             = require('../../services/wisp.service');
const { ESTADOS }      = require('../constants');
const { ConversacionMeta } = require('../conversacion.meta');
const {
  EMPRESAS,
  TIPO_CLIENTE,
  TIPO_IDENTIFICACION,
  AUTOSERVICIO,
  AUTOSERVICIO_BASICO,
  generarTecladoServicios,
} = require('../keyboards');

const NOMBRES_EMPRESA = {
  fibratec:   'Fibratec',
  compusemmm: 'Compusemmm de México',
};

async function handle(_mensaje, conversacion, usuario, _io, empresaPreconfigurada) {
  const nombre = (usuario?.nombre || 'cliente').split(' ')[0];

  if (!empresaPreconfigurada) {
    return {
      respuesta:   `👋 ¡Hola, ${nombre}! Bienvenido/a.\n\n¿A cuál de nuestras empresas deseas comunicarte?`,
      nuevoEstado: ESTADOS.SELECCION_EMPRESA,
      teclado:     EMPRESAS,
    };
  }

  const empresa = NOMBRES_EMPRESA[conversacion.empresa_id] || conversacion.empresa_id;

  const { rows: cerradas } = await conversacionRepo.findCerradasByUsuario(
    conversacion.usuario_id,
    conversacion.empresa_id
  );
  const esRecurrente = cerradas.length > 0;

  if (esRecurrente) {
    const wispGuardado = usuario?.wisp_data?.empresa_id === conversacion.empresa_id
      ? usuario.wisp_data
      : null;
    const clienteWisp = wispGuardado || wisp.buscarPorExternalId(usuario?.external_id, conversacion.empresa_id);

    if (clienteWisp) {
      const yaIdentificado = !!wispGuardado;
      const meta = new ConversacionMeta({ cliente: clienteWisp, servicio_idx: 0, identificado_via_wisp: yaIdentificado });
      await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());

      if (meta.esMultiServicio) {
        const listaTexto = clienteWisp.servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
        return {
          respuesta:   `👋 ¡Hola de nuevo, ${clienteWisp.nombre.split(' ')[0]}! Bienvenido/a a ${empresa}.\n\n` +
                       `Tienes varios servicios registrados. ¿Cuál deseas consultar?\n\n${listaTexto}`,
          nuevoEstado: ESTADOS.SELECCION_SERVICIO,
          teclado:     generarTecladoServicios(clienteWisp.servicios),
        };
      }

      const teclado = yaIdentificado ? AUTOSERVICIO : AUTOSERVICIO_BASICO;
      return {
        respuesta:   `👋 ¡Hola de nuevo, ${clienteWisp.nombre.split(' ')[0]}! Bienvenido/a a ${empresa}.\n\n¿En qué puedo ayudarte hoy?`,
        nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
        teclado,
      };
    }

    return {
      respuesta:   `👋 ¡Hola de nuevo, ${nombre}! Bienvenido/a a ${empresa}.\n\n` +
                   `Para consultar tu servicio, necesito verificar tus datos. ¿Con qué te identificas?`,
      nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
      teclado:     TIPO_IDENTIFICACION,
    };
  }

  return {
    respuesta:   `👋 ¡Hola, ${nombre}! Bienvenido/a a ${empresa}.\n\n¿Cómo puedo ayudarte?`,
    nuevoEstado: ESTADOS.MENU_TIPO_CLIENTE,
    teclado:     TIPO_CLIENTE,
  };
}

module.exports = { handle };
