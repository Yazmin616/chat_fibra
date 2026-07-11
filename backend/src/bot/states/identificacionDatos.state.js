/**
 * @file identificacionDatos.state.js
 * @description Manejador del estado IDENTIFICACION_DATOS.
 *
 * Flujo de 2 fases controlado por meta.tipo_identificacion:
 *
 *   Fase 1 (sin tipo_identificacion):
 *     Muestra botones con el tipo de dato para identificarse.
 *     "asesor" → earlyReturn a ESPERANDO_AGENTE (Soporte Técnico).
 *
 *   Fase 2 (con tipo_identificacion):
 *     El cliente escribe su dato → búsqueda en WISP.
 *     Encontrado  → SELECCION_SERVICIO o MENU_AUTOSERVICIO
 *     No encontrado → incrementa intentos, vuelve a Fase 1 (máx 3)
 */

const conversacionRepo          = require('../../repositories/conversacion.repository');
const mensajeRepo               = require('../../repositories/mensaje.repository');
const wisp                      = require('../../services/wisp.service');
const { parseTipoIdentificacion } = require('../parsers');
const { ESTADOS, DEPARTAMENTOS }  = require('../constants');
const { ConversacionMeta }        = require('../conversacion.meta');
const keyboards = require('../keyboards');
const { getTexto } = require('../../services/plantillas.service');

const MAX_INTENTOS = 3;

const LABELS_TIPO = {
  id_cliente: 'ID de cliente',
  tel:        'número de teléfono',
  contrato:   'ID de contrato',
  email:      'correo electrónico',
  usuario:    'nombre de usuario',
  wifi:       'nombre de red WiFi',
  cedula:     'cédula',
};

async function handle(mensaje, conversacion, usuario, io) {
  const meta = new ConversacionMeta(conversacion.metadata);
  const m    = mensaje.trim().toLowerCase();

  // --- FASE 1: selección de tipo de dato ---
  if (!meta.tipo_identificacion) {
    const tipo = parseTipoIdentificacion(mensaje);

    if (tipo === 'asesor' || m.includes('asesor')) {
      const confirmacion = await getTexto('escalar_soporte', conversacion.empresa_id, { departamento: DEPARTAMENTOS.SOPORTE });
      return _escalarASoporte(conversacion, confirmacion);
    }

    if (!tipo) {
      const respuesta = await getTexto('identificacion_tipo', conversacion.empresa_id);
      return {
        respuesta,
        nuevoEstado: conversacion.estado,
        teclado: await keyboards.get('TIPO_IDENTIFICACION', conversacion.empresa_id),
      };
    }

    await conversacionRepo.updateMetadata(conversacion.id, { ...meta.toJSON(), tipo_identificacion: tipo });
    const respuesta = await getTexto('identificacion_pedir_dato', conversacion.empresa_id, { tipo_dato: LABELS_TIPO[tipo] });
    return {
      respuesta,
      nuevoEstado: conversacion.estado,
    };
  }

  // --- FASE 2: recepción del valor e intento de identificación ---
  if (m === 'asesor' || m.includes('asesor')) {
    const confirmacion = await getTexto('escalar_soporte', conversacion.empresa_id, { departamento: DEPARTAMENTOS.SOPORTE });
    return _escalarASoporte(conversacion, confirmacion);
  }

  const cliente = wisp.buscar(mensaje, conversacion.empresa_id);

  if (cliente) {
    const metaActualizada = new ConversacionMeta({
      ...meta.toJSON(),
      cliente,
      servicio_idx:          0,
      identificado_via_wisp: true,
      tipo_identificacion:   null,
    });
    await conversacionRepo.updateMetadata(conversacion.id, metaActualizada.toJSON());

    if (meta.consulta_ajena) {
      const nombre = cliente.nombre;
      if (metaActualizada.esMultiServicio) {
        const listaTexto = cliente.servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
        const respuesta = await getTexto('cuenta_encontrada_ajena_multi', conversacion.empresa_id, { nombre, lista_servicios: listaTexto });
        return {
          respuesta,
          nuevoEstado: ESTADOS.SELECCION_SERVICIO,
          teclado:     keyboards.generarTecladoServicios(cliente.servicios),
        };
      }
      const respuesta = await getTexto('cuenta_encontrada_ajena', conversacion.empresa_id, { nombre });
      return {
        respuesta,
        nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
        teclado:     await keyboards.getAutoservicioKeyboard(metaActualizada.toJSON(), conversacion.empresa_id),
      };
    }

    const respuesta = await getTexto('cuenta_encontrada_mia', conversacion.empresa_id, { nombre: cliente.nombre });
    return {
      respuesta,
      nuevoEstado: ESTADOS.CONFIRMAR_CUENTA,
      teclado: await keyboards.get('CONFIRMAR_CUENTA', conversacion.empresa_id),
    };
  }

  // No encontrado
  const nuevosIntentos = meta.intentos_identificacion + 1;
  if (nuevosIntentos >= MAX_INTENTOS) {
    const confirmacion = await getTexto('identificacion_fallida_final', conversacion.empresa_id);
    return _escalarASoporte(conversacion, confirmacion, io);
  }

  await conversacionRepo.updateMetadata(conversacion.id, {
    ...meta.toJSON(),
    tipo_identificacion:     null,
    intentos_identificacion: nuevosIntentos,
  });

  const restantes = MAX_INTENTOS - nuevosIntentos;
  const respuesta = await getTexto('identificacion_no_encontrado', conversacion.empresa_id, { intentos: restantes });
  return {
    respuesta,
    nuevoEstado: conversacion.estado,
    teclado: await keyboards.get('TIPO_IDENTIFICACION', conversacion.empresa_id),
  };
}

async function _escalarASoporte(conversacion, confirmacion, io) {
  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  const { rows } = await conversacionRepo.createEsperando(
    conversacion.usuario_id, conversacion.empresa_id, DEPARTAMENTOS.SOPORTE
  );
  const nuevaConvId = rows[0].id;

  const { aplicarRoundRobin } = require('../../services/asignacion.service');
  await aplicarRoundRobin(nuevaConvId, conversacion.empresa_id, DEPARTAMENTOS.SOPORTE, io);

  await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${DEPARTAMENTOS.SOPORTE}`);
  await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);
  return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: DEPARTAMENTOS.SOPORTE } };
}

module.exports = { handle };
