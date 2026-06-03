/**
 * @file seleccionEmpresa.state.js
 * @description Manejador del estado SELECCION_EMPRESA.
 *
 * El cliente elige entre Fibratec (1) o Compusemmm (2). Tras confirmar,
 * verifica si es cliente recurrente o nuevo y lo dirige al estado correcto:
 *   Recurrente reconocido en WISP → SELECCION_SERVICIO / MENU_AUTOSERVICIO
 *   Recurrente no reconocido      → IDENTIFICACION_DATOS
 *   Cliente nuevo                 → MENU_TIPO_CLIENTE
 */

const conversacionRepo  = require('../../repositories/conversacion.repository');
const wisp              = require('../../services/wisp.service');
const { parseEmpresa }  = require('../parsers');
const { ESTADOS }       = require('../constants');
const { ConversacionMeta } = require('../conversacion.meta');
const {
  EMPRESAS,
  TIPO_CLIENTE,
  TIPO_IDENTIFICACION,
  AUTOSERVICIO_BASICO,
  generarTecladoServicios,
} = require('../keyboards');

async function handle(mensaje, conversacion, usuario) {
  const { empresa, nombre } = parseEmpresa(mensaje);

  if (!empresa) {
    return {
      respuesta:   '⚠️ Opción no reconocida. Por favor elige una empresa:',
      nuevoEstado: conversacion.estado,
      teclado:     EMPRESAS,
    };
  }

  await conversacionRepo.updateEmpresa(conversacion.id, empresa);

  const { rows: cerradas } = await conversacionRepo.findCerradasByUsuario(
    conversacion.usuario_id,
    empresa
  );
  const esRecurrente = cerradas.length > 0;

  if (esRecurrente) {
    const wispGuardado = usuario?.wisp_data?.empresa_id === empresa
      ? usuario.wisp_data
      : null;
    const clienteWisp = wispGuardado || wisp.buscarPorExternalId(usuario?.external_id, empresa);

    if (clienteWisp) {
      const yaIdentificado = !!wispGuardado;
      const meta = new ConversacionMeta({ cliente: clienteWisp, servicio_idx: 0, identificado_via_wisp: yaIdentificado });
      await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());

      if (meta.esMultiServicio) {
        const listaTexto = clienteWisp.servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
        return {
          respuesta:   `✅ Has seleccionado ${nombre}.\n\n` +
                       `¡Hola de nuevo, ${clienteWisp.nombre.split(' ')[0]}! Tienes varios servicios. ¿Cuál deseas consultar?\n\n${listaTexto}`,
          nuevoEstado: ESTADOS.SELECCION_SERVICIO,
          teclado:     generarTecladoServicios(clienteWisp.servicios),
        };
      }

      const teclado = yaIdentificado ? AUTOSERVICIO_BASICO : AUTOSERVICIO_BASICO;
      return {
        respuesta:   `✅ Has seleccionado ${nombre}.\n\n¡Bienvenido/a de vuelta, ${clienteWisp.nombre.split(' ')[0]}! ¿En qué puedo ayudarte?`,
        nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
        teclado,
      };
    }

    return {
      respuesta:   `✅ Has seleccionado ${nombre}.\n\n` +
                   `Para consultar tu servicio, necesito verificar tus datos. ¿Con qué te identificas?`,
      nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
      teclado:     TIPO_IDENTIFICACION,
    };
  }

  return {
    respuesta:   `✅ Has seleccionado ${nombre}.\n\n¿Cómo puedo ayudarte?`,
    nuevoEstado: ESTADOS.MENU_TIPO_CLIENTE,
    teclado:     TIPO_CLIENTE,
  };
}

module.exports = { handle };
