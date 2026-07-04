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
const keyboards = require('../keyboards');

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
      teclado: await keyboards.get('EMPRESAS', conversacion.empresa_id),
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
          teclado:     keyboards.generarTecladoServicios(clienteWisp.servicios),
        };
      }

      const teclado = await keyboards.getAutoservicioKeyboard(meta, conversacion.empresa_id);
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
      teclado: await keyboards.get('TIPO_IDENTIFICACION', conversacion.empresa_id),
    };
  }

  return {
    respuesta:   `👋 ¡Hola, ${nombre}! Bienvenido/a a ${empresa}.\n\n¿Cómo puedo ayudarte? Toca una opción o escribe tu consulta.\n\n_Para hablar directamente con un asesor, escribe "asesor"._`,
    nuevoEstado: ESTADOS.MENU_TIPO_CLIENTE,
    teclado: await keyboards.get('TIPO_CLIENTE', conversacion.empresa_id),
  };
}

module.exports = { handle };
