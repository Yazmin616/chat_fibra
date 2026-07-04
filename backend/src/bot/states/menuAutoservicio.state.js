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

const INTENTOS_MAX = 3;

async function handle(mensaje, conversacion) {
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
        return {
          respuesta:   '🧑‍💼 ¿Con qué área deseas hablar?',
          nuevoEstado: ESTADOS.SELECCION_AREA,
          teclado: await keyboards.get('AREAS', conversacion.empresa_id),
        };
      }
      if (intencion === 'soporte') {
        return _escalar(conversacion, DEPARTAMENTOS.SOPORTE,
          `🔧 Entendí que tienes un problema técnico.\n\nTe conectamos con *${DEPARTAMENTOS.SOPORTE}*. Describe tu problema y un asesor te atenderá pronto. 🙏`
        );
      }
      if (intencion === 'cobranza') {
        return _escalar(conversacion, DEPARTAMENTOS.COBRANZA,
          `💰 Entendí que tu consulta es sobre pagos o saldos.\n\nTe conectamos con *${DEPARTAMENTOS.COBRANZA}*. Un asesor te atenderá en breve. 🙏`
        );
      }
      if (intencion === 'ventas') {
        return _escalar(conversacion, DEPARTAMENTOS.VENTAS,
          `🆕 Entendí que quieres información sobre planes o contratos.\n\nTe conectamos con *${DEPARTAMENTOS.VENTAS}*. ¡Pronto un asesor te contactará! 🙏`
        );
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
      return {
        respuesta:   '🧑‍💼 Parece que necesitas ayuda con algo específico. Te conecto con un asesor.\n\n¿Con qué área quieres hablar?',
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
    return _escalar(conversacion, DEPARTAMENTOS.SOPORTE,
      `🔧 Te conectamos con *${DEPARTAMENTOS.SOPORTE}*.\n\nDescribe tu problema y un asesor te atenderá pronto. 🙏`
    );
  }

  if (opcion === 'comprobante') {
    return _escalar(conversacion, DEPARTAMENTOS.COBRANZA,
      `✅ Te conectamos con *${DEPARTAMENTOS.COBRANZA}* para validar tu comprobante.\n\nPor favor envía la imagen de tu comprobante. 🙏`
    );
  }

  if (opcion === 'asesor') {
    return {
      respuesta:   '🧑‍💼 ¿Con qué área deseas hablar?',
      nuevoEstado: ESTADOS.SELECCION_AREA,
      teclado: await keyboards.get('AREAS', conversacion.empresa_id),
    };
  }

  const servicio = meta.servicio;

  if (opcion === 'deuda') {
    return {
      respuesta:   _formatDeuda(servicio) + '\n\n¿Deseas realizar otra consulta?',
      nuevoEstado: ESTADOS.OTRA_CONSULTA,
      teclado:     await keyboards.getOtraConsultaKeyboard(meta.toJSON(), conversacion.empresa_id),
    };
  }

  if (opcion === 'pago') {
    return {
      respuesta:   _formatPago(servicio) + '\n\n¿Deseas realizar otra consulta?',
      nuevoEstado: ESTADOS.OTRA_CONSULTA,
      teclado:     await keyboards.getOtraConsultaKeyboard(meta.toJSON(), conversacion.empresa_id),
    };
  }
}

function _formatDeuda(servicio) {
  if (!servicio) {
    return '⚠️ No se pudo obtener información de tu cuenta. Por favor intenta de nuevo o escribe *asesor*.';
  }
  if (servicio.deuda > 0) {
    const estadoIcon = servicio.estado === 'suspendido' ? '🔴 Suspendido' : '🟢 Activo';
    return `💰 *Estado de cuenta*\n\n` +
           `📋 ${servicio.etiqueta}\n` +
           `💵 Saldo pendiente: *$${servicio.deuda.toFixed(2)} MXN*\n` +
           `📅 Fecha límite: ${servicio.fecha_vencimiento}\n` +
           `📶 Servicio: ${estadoIcon}`;
  }
  return `✅ *Estado de cuenta*\n\n📋 ${servicio.etiqueta}\n\n¡Estás al corriente! No tienes saldo pendiente. 🎉`;
}

function _formatPago(servicio) {
  if (!servicio) {
    return '⚠️ No se pudo obtener información de pago. Por favor intenta de nuevo o escribe *asesor*.';
  }
  return `📍 *¿Dónde pagar?*\n\n` +
         `Para tu servicio *${servicio.etiqueta}* puedes pagar en:\n\n` +
         `🔗 Portal en línea:\n${servicio.portal_pago}\n\n` +
         `🏪 También puedes pagar en cualquiera de nuestras sucursales o corresponsales autorizados.`;
}

async function _escalar(conversacion, departamento, confirmacion) {
  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  const { rows } = await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, departamento);
  const nuevaConvId = rows[0].id;
  await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${departamento}`);
  await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);
  return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento } };
}

module.exports = { handle };
