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
const { getTexto } = require('../../services/plantillas.service');

const NOMBRES_EMPRESA = {
  fibratec:   'Fibratec',
  compusemmm: 'Compusemmm de México',
};

async function handle(_mensaje, conversacion, usuario, _io, empresaPreconfigurada) {
  const nombre = (usuario?.nombre || 'cliente').split(' ')[0];

  if (!empresaPreconfigurada) {
    const respuesta = await getTexto('seleccion_empresa', conversacion.empresa_id, { nombre });
    return {
      respuesta,
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

  // NLU en el primer mensaje
  if (_mensaje && _mensaje.trim().match(/[a-zA-Z]/)) {
    const { detectarTodasCoincidentes } = require('../nlu');
    const coincidentes = await detectarTodasCoincidentes(_mensaje, conversacion.empresa_id || '__todas__');
    
    if (coincidentes.length > 0) {
      if (esRecurrente) {
        const wispGuardado = usuario?.wisp_data?.empresa_id === conversacion.empresa_id
          ? usuario.wisp_data
          : null;
        const clienteWisp = wispGuardado || wisp.buscarPorExternalId(usuario?.external_id, conversacion.empresa_id);
        
        if (clienteWisp) {
          const yaIdentificado = !!wispGuardado;
          const meta = new ConversacionMeta({ cliente: clienteWisp, servicio_idx: 0, identificado_via_wisp: yaIdentificado });
          await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());
          conversacion.metadata = meta.toJSON();
          conversacion.estado = ESTADOS.MENU_AUTOSERVICIO;
          return require('./menuAutoservicio.state').handle(_mensaje, conversacion, usuario, _io);
        }
      }
      
      conversacion.estado = ESTADOS.MENU_TIPO_CLIENTE;
      return require('./menuTipoCliente.state').handle(_mensaje, conversacion, usuario, _io);
    }
  }

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
        const respuesta = await getTexto('saludo_recurrente_multiservicio', conversacion.empresa_id, {
          nombre: clienteWisp.nombre.split(' ')[0],
          empresa,
          lista_servicios: listaTexto
        });
        return {
          respuesta,
          nuevoEstado: ESTADOS.SELECCION_SERVICIO,
          teclado:     keyboards.generarTecladoServicios(clienteWisp.servicios),
        };
      }

      const teclado = await keyboards.getAutoservicioKeyboard(meta, conversacion.empresa_id);
      const respuesta = await getTexto('saludo_recurrente_autoservicio', conversacion.empresa_id, {
        nombre: clienteWisp.nombre.split(' ')[0],
        empresa
      });
      return {
        respuesta,
        nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
        teclado,
      };
    }
  }

  const respuesta = await getTexto('saludo_inicial', conversacion.empresa_id, { nombre, empresa });
  return {
    respuesta,
    nuevoEstado: ESTADOS.MENU_TIPO_CLIENTE,
    teclado: await keyboards.get('TIPO_CLIENTE', conversacion.empresa_id),
  };
}

module.exports = { handle };
