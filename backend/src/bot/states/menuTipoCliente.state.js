/**
 * @file menuTipoCliente.state.js
 * @description Manejador del estado MENU_TIPO_CLIENTE.
 *
 * Se muestra a clientes nuevos para determinar si ya son clientes
 * o quieren contratar un servicio.
 *   "Soy cliente"      → IDENTIFICACION_DATOS
 *   "Quiero contratar" → earlyReturn a ESPERANDO_AGENTE (Ventas)
 */

const conversacionRepo     = require('../../repositories/conversacion.repository');
const mensajeRepo          = require('../../repositories/mensaje.repository');
const { parseTipoCliente } = require('../parsers');
const { ESTADOS, DEPARTAMENTOS } = require('../constants');
const { TIPO_CLIENTE, TIPO_IDENTIFICACION } = require('../keyboards');

async function handle(mensaje, conversacion) {
  const tipo = parseTipoCliente(mensaje);

  if (tipo === 'soy_cliente') {
    return {
      respuesta:   '🔍 ¿Con qué dato deseas identificarte?',
      nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
      teclado:     TIPO_IDENTIFICACION,
    };
  }

  if (tipo === 'contratar') {
    const confirmacion = '🆕 Con gusto te atendemos.\n\nTe conectamos con nuestro equipo de *Ventas*. ¡Pronto un asesor te contactará! 🙏';
    await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
    const { rows } = await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, DEPARTAMENTOS.VENTAS);
    const nuevaConvId = rows[0].id;
    await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${DEPARTAMENTOS.VENTAS}`);
    await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);
    return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: DEPARTAMENTOS.VENTAS } };
  }

  return {
    respuesta:   '⚠️ Opción no reconocida. ¿Cómo puedo ayudarte?',
    nuevoEstado: conversacion.estado,
    teclado:     TIPO_CLIENTE,
  };
}

module.exports = { handle };
