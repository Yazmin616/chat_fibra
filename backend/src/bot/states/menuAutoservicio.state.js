/**
 * @file menuAutoservicio.state.js
 * @description Manejador del estado MENU_AUTOSERVICIO.
 *
 * Menú principal de autoservicio para clientes identificados:
 *   deuda       → muestra saldo pendiente → OTRA_CONSULTA
 *   pago        → muestra info de pago    → OTRA_CONSULTA
 *   falla       → earlyReturn a ESPERANDO_AGENTE (Soporte Técnico)
 *   comprobante → earlyReturn a ESPERANDO_AGENTE (Cobranza)
 *   asesor      → SELECCION_AREA
 */

const conversacionRepo     = require('../../repositories/conversacion.repository');
const mensajeRepo          = require('../../repositories/mensaje.repository');
const { parseAutoservicio }  = require('../parsers');
const { ESTADOS, DEPARTAMENTOS } = require('../constants');
const { ConversacionMeta }   = require('../conversacion.meta');
const keyboards = require('../keyboards');
const { detectarTodasCoincidentes } = require('../nlu');
const { getTexto } = require('../../services/plantillas.service');
const { getAreasSolucionesText } = require('../../utils/areasSolucionesHelper');

const INTENTOS_MAX = 3;

async function handle(mensaje, conversacion, usuario, io) {
  const opcion = parseAutoservicio(mensaje);
  const meta   = new ConversacionMeta(conversacion.metadata);
  const teclado = await keyboards.getAutoservicioKeyboard(meta.toJSON(), conversacion.empresa_id);

  if (opcion === 'consulta_ajena') {
    await conversacionRepo.updateMetadata(conversacion.id, {
      ...meta.toJSON(),
      consulta_ajena:      true,
      tipo_identificacion: null,
    });
    return {
      respuesta:   '👥 De acuerdo. ¿Con qué dato identifico a la persona?',
      nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
      teclado: await keyboards.get('TIPO_IDENTIFICACION', conversacion.empresa_id),
    };
  }

  if (opcion === 'cambiar_servicio') {
    const servicios  = meta.cliente?.servicios || [];
    const listaTexto = servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
    return {
      respuesta:   `🔄 ¿Cuál servicio deseas consultar?\n\n${listaTexto}`,
      nuevoEstado: ESTADOS.SELECCION_SERVICIO,
      teclado:     keyboards.generarTecladoServicios(servicios),
    };
  }

  if (!opcion) {
    // NLU: analizar texto libre antes de declarar la opción como no reconocida
    const empresa_id   = conversacion.empresa_id || '__todas__';
    const coincidentes = await detectarTodasCoincidentes(mensaje, empresa_id);

    if (coincidentes.length === 1) {
      const { intencion } = coincidentes[0];
      if (intencion === 'asesor') {
        const areasInfo = await getAreasSolucionesText(conversacion.empresa_id);
        return {
          respuesta:   `🧑‍💼 ¿Con qué área deseas hablar?${areasInfo}`,
          nuevoEstado: ESTADOS.SELECCION_AREA,
          teclado: await keyboards.get('AREAS', conversacion.empresa_id),
        };
      }
      if (intencion === 'soporte') {
        const confirmacion = await getTexto('escalar_soporte', conversacion.empresa_id, { departamento: DEPARTAMENTOS.SOPORTE });
        return _escalar(conversacion, DEPARTAMENTOS.SOPORTE, confirmacion);
      }
      if (intencion === 'cobranza') {
        const confirmacion = await getTexto('escalar_cobranza', conversacion.empresa_id, { departamento: DEPARTAMENTOS.COBRANZA });
        return _escalar(conversacion, DEPARTAMENTOS.COBRANZA, confirmacion);
      }
      if (intencion === 'ventas') {
        const confirmacion = await getTexto('escalar_ventas', conversacion.empresa_id, { departamento: DEPARTAMENTOS.VENTAS });
        return _escalar(conversacion, DEPARTAMENTOS.VENTAS, confirmacion);
      }
    }

    if (coincidentes.length >= 2) {
      const areas    = coincidentes.filter(i => i.intencion !== 'asesor');
      const paraMenu = areas.length >= 2 ? areas : coincidentes;
      return {
        respuesta:   '🤔 Tu mensaje puede referirse a varias cosas. ¿Con cuál puedo ayudarte?',
        nuevoEstado: conversacion.estado,
        teclado:     keyboards.generarTecladoAmbiguo(paraMenu),
      };
    }

    // Sin coincidencias: contar intentos y escalar tras INTENTOS_MAX
    meta.intentos_fallidos = (meta.intentos_fallidos || 0) + 1;
    await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());

    if (meta.intentos_fallidos >= INTENTOS_MAX) {
      const areasInfo = await getAreasSolucionesText(conversacion.empresa_id);
      return {
        respuesta:   `🧑‍💼 Parece que necesitas ayuda con algo específico. Te conecto con un asesor.\n\n¿Con qué área quieres hablar?${areasInfo}`,
        nuevoEstado: ESTADOS.SELECCION_AREA,
        teclado: await keyboards.get('AREAS', conversacion.empresa_id),
      };
    }

    return {
      respuesta:   '⚠️ No entendí. ¿En qué puedo ayudarte?\n\nToca una opción o escríbeme tu consulta.',
      nuevoEstado: conversacion.estado,
      teclado,
    };
  }

  if (opcion === 'falla') {
    const confirmacion = await getTexto('escalar_soporte', conversacion.empresa_id, { departamento: DEPARTAMENTOS.SOPORTE });
    return _escalar(conversacion, DEPARTAMENTOS.SOPORTE, confirmacion, io);
  }

  if (opcion === 'comprobante') {
    const confirmacion = await getTexto('escalar_cobranza', conversacion.empresa_id, { departamento: DEPARTAMENTOS.COBRANZA });
    return _escalar(conversacion, DEPARTAMENTOS.COBRANZA, confirmacion, io);
  }

  if (opcion === 'asesor') {
    const areasInfo = await getAreasSolucionesText(conversacion.empresa_id);
    return {
      respuesta:   `🧑‍💼 ¿Con qué área deseas hablar?${areasInfo}`,
      nuevoEstado: ESTADOS.SELECCION_AREA,
      teclado: await keyboards.get('AREAS', conversacion.empresa_id),
    };
  }

  const servicio = meta.servicio;

  if (opcion === 'deuda') {
    const textoDeuda = await _formatDeuda(servicio, conversacion.empresa_id);
    const textoConsulta = await getTexto('menu_otra_consulta', conversacion.empresa_id);
    return {
      respuesta:   textoDeuda + '\n\n' + textoConsulta,
      nuevoEstado: ESTADOS.OTRA_CONSULTA,
      teclado:     await keyboards.getOtraConsultaKeyboard(meta.toJSON(), conversacion.empresa_id),
    };
  }

  if (opcion === 'pago') {
    const textoPago = await _formatPago(servicio, conversacion.empresa_id);
    const textoConsulta = await getTexto('menu_otra_consulta', conversacion.empresa_id);
    return {
      respuesta:   textoPago + '\n\n' + textoConsulta,
      nuevoEstado: ESTADOS.OTRA_CONSULTA,
      teclado:     await keyboards.getOtraConsultaKeyboard(meta.toJSON(), conversacion.empresa_id),
    };
  }
}

async function _formatDeuda(servicio, empresa_id) {
  if (!servicio) {
    return await getTexto('error_general', empresa_id);
  }
  if (servicio.deuda > 0) {
    const estadoIcon = servicio.estado === 'suspendido' ? '🔴 Suspendido' : '🟢 Activo';
    return await getTexto('estado_cuenta_con_deuda', empresa_id, {
      etiqueta: servicio.etiqueta,
      deuda: servicio.deuda.toFixed(2),
      fecha_vencimiento: servicio.fecha_vencimiento,
      estado_icon: estadoIcon
    });
  }
  return await getTexto('estado_cuenta_sin_deuda', empresa_id, { etiqueta: servicio.etiqueta });
}

async function _formatPago(servicio, empresa_id) {
  if (!servicio) {
    return await getTexto('error_general', empresa_id);
  }
  return await getTexto('info_pago', empresa_id, {
    etiqueta: servicio.etiqueta,
    portal_pago: servicio.portal_pago
  });
}

async function _escalar(conversacion, departamento, confirmacion, io) {
  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  const { rows } = await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, departamento);
  const nuevaConvId = rows[0].id;

  const { aplicarRoundRobin } = require('../../services/asignacion.service');
  await aplicarRoundRobin(nuevaConvId, conversacion.empresa_id, departamento, io);

  await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${departamento}`);
  await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);
  return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento } };
}

module.exports = { handle };
