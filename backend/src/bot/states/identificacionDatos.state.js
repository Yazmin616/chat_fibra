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
const {
  TIPO_IDENTIFICACION,
  CONFIRMAR_CUENTA,
  getAutoservicioKeyboard,
  generarTecladoServicios,
} = require('../keyboards');

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

async function handle(mensaje, conversacion) {
  const meta = new ConversacionMeta(conversacion.metadata);
  const m    = mensaje.trim().toLowerCase();

  // --- FASE 1: selección de tipo de dato ---
  if (!meta.tipo_identificacion) {
    const tipo = parseTipoIdentificacion(mensaje);

    if (tipo === 'asesor' || m.includes('asesor')) {
      return _escalarASoporte(conversacion, '🧑‍💼 Te conectamos con un asesor. En breve alguien te atenderá. 🙏');
    }

    if (!tipo) {
      return {
        respuesta:   '⚠️ Por favor selecciona una opción para identificarte:',
        nuevoEstado: conversacion.estado,
        teclado:     TIPO_IDENTIFICACION,
      };
    }

    await conversacionRepo.updateMetadata(conversacion.id, { ...meta.toJSON(), tipo_identificacion: tipo });
    return {
      respuesta:   `📝 Por favor escribe tu *${LABELS_TIPO[tipo]}*:`,
      nuevoEstado: conversacion.estado,
    };
  }

  // --- FASE 2: recepción del valor e intento de identificación ---
  if (m === 'asesor' || m.includes('asesor')) {
    return _escalarASoporte(conversacion, '🧑‍💼 Te conectamos con un asesor. En breve alguien te atenderá. 🙏');
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
      const nombre = cliente.nombre.split(' ')[0];
      if (metaActualizada.esMultiServicio) {
        const listaTexto = cliente.servicios.map((s, i) => `${i + 1}️⃣  ${s.etiqueta}`).join('\n');
        return {
          respuesta:   `✅ Cuenta de *${nombre}* encontrada.\n\n¿Cuál servicio deseas consultar?\n\n${listaTexto}`,
          nuevoEstado: ESTADOS.SELECCION_SERVICIO,
          teclado:     generarTecladoServicios(cliente.servicios),
        };
      }
      return {
        respuesta:   `✅ Cuenta de *${nombre}* encontrada.\n\n¿En qué puedo ayudarte?`,
        nuevoEstado: ESTADOS.MENU_AUTOSERVICIO,
        teclado:     getAutoservicioKeyboard(metaActualizada.toJSON()),
      };
    }

    return {
      respuesta:   `✅ Encontramos la cuenta de *${cliente.nombre}*.\n\n¿Es tu cuenta?`,
      nuevoEstado: ESTADOS.CONFIRMAR_CUENTA,
      teclado:     CONFIRMAR_CUENTA,
    };
  }

  // No encontrado
  const nuevosIntentos = meta.intentos_identificacion + 1;
  if (nuevosIntentos >= MAX_INTENTOS) {
    return _escalarASoporte(conversacion,
      `⚠️ No pudimos identificarte con los datos proporcionados.\n\n` +
      `Te conectamos con un asesor para que pueda ayudarte directamente. 🙏`
    );
  }

  await conversacionRepo.updateMetadata(conversacion.id, {
    ...meta.toJSON(),
    tipo_identificacion:     null,
    intentos_identificacion: nuevosIntentos,
  });

  const restantes = MAX_INTENTOS - nuevosIntentos;
  return {
    respuesta:   `❌ No encontramos ningún servicio con ese dato.\n\n` +
                 `Intenta con otro tipo de identificación _(${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''})_:`,
    nuevoEstado: conversacion.estado,
    teclado:     TIPO_IDENTIFICACION,
  };
}

async function _escalarASoporte(conversacion, confirmacion) {
  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  const { rows } = await conversacionRepo.createEsperando(
    conversacion.usuario_id, conversacion.empresa_id, DEPARTAMENTOS.SOPORTE
  );
  const nuevaConvId = rows[0].id;
  await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${DEPARTAMENTOS.SOPORTE}`);
  await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);
  return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: DEPARTAMENTOS.SOPORTE } };
}

module.exports = { handle };
