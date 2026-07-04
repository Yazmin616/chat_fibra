/**
 * @file menuTipoCliente.state.js
 * @description Manejador del estado MENU_TIPO_CLIENTE.
 *
 * Flujo:
 *   1. Si hay intencion_pendiente en metadata → etapa de confirmación (Sí/No).
 *   2. Si el mensaje es un callback "intencion:X" → el cliente resolvió ambigüedad.
 *   3. parseTipoCliente() para botones del menú (soy_cliente / contratar / asesor).
 *   4. NLU: detectarTodasCoincidentes().
 *      - 0 coincidencias → contar intentos fallidos, escalar tras 3.
 *      - 1 coincidencia "asesor" → ir a SELECCION_AREA.
 *      - 1 coincidencia área → pedir confirmación (guarda intencion_pendiente).
 *      - 2+ coincidencias → mostrar teclado con las opciones detectadas.
 */

const conversacionRepo              = require('../../repositories/conversacion.repository');
const mensajeRepo                   = require('../../repositories/mensaje.repository');
const { parseTipoCliente }          = require('../parsers');
const { ESTADOS, DEPARTAMENTOS }    = require('../constants');
const keyboards = require('../keyboards');
const { ConversacionMeta }          = require('../conversacion.meta');
const { normalizar, detectarTodasCoincidentes } = require('../nlu');

const INTENTOS_MAX = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Ejecuta la acción correspondiente a una intención ya confirmada. */
async function ejecutarIntencion({ intencion, depto }, conversacion) {
  if (intencion === 'asesor') {
    return {
      respuesta:   '🧑‍💼 Claro, te ayudo a conectar con un asesor.\n\n¿Con qué área quieres hablar?',
      nuevoEstado: ESTADOS.SELECCION_AREA,
      teclado: await keyboards.get('AREAS', conversacion.empresa_id),
    };
  }

  if (intencion === 'ventas') {
    const confirmacion = '🆕 Con gusto te atendemos.\n\nTe conectamos con nuestro equipo de *Ventas*. ¡Pronto un asesor te contactará! 🙏';
    await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
    const { rows } = await conversacionRepo.createEsperando(
      conversacion.usuario_id,
      conversacion.empresa_id,
      DEPARTAMENTOS.VENTAS,
    );
    const nuevaConvId = rows[0].id;
    await mensajeRepo.create(nuevaConvId, 'sistema_info', `CLIENTE EN ESPERA — ${DEPARTAMENTOS.VENTAS}`);
    await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);
    return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: DEPARTAMENTOS.VENTAS } };
  }

  // soporte / cobranza / intención personalizada con área
  const area = depto || intencion;
  return {
    respuesta:   `🔍 Te comunico con *${area}*. Para atenderte mejor, ¿con qué dato deseas identificarte?\n\n_(O escribe "asesor" si prefieres hablar directamente con alguien.)_`,
    nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
    teclado: await keyboards.get('TIPO_IDENTIFICACION', conversacion.empresa_id),
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────

async function handle(mensaje, conversacion) {
  const meta = new ConversacionMeta(conversacion.metadata);

  // ── Etapa 1: confirmación pendiente ──────────────────────────────────────
  if (meta.intencion_pendiente) {
    const raw  = mensaje.trim();
    const norm = normalizar(raw);

    const esConfirmar = raw === 'confirmar_si' ||
      /^(si|yes|ok|dale|claro|correcto|exacto|afirmativo|bueno)\b/.test(norm);
    const esRechazar  = raw === 'confirmar_no' ||
      /^(no|volver|cancelar|regresar|otra|otro)\b/.test(norm);

    if (esConfirmar) {
      const pending = { ...meta.intencion_pendiente };
      meta.intencion_pendiente = null;
      meta.intentos_fallidos   = 0;
      await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());
      return ejecutarIntencion(pending, conversacion);
    }

    if (esRechazar) {
      meta.intencion_pendiente = null;
      await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());
      return {
        respuesta:   'De acuerdo. ¿Cómo puedo ayudarte? Toca una opción o escribe tu consulta.',
        nuevoEstado: conversacion.estado,
        teclado: await keyboards.get('TIPO_CLIENTE', conversacion.empresa_id),
      };
    }

    const deptoLabel = meta.intencion_pendiente.depto || meta.intencion_pendiente.intencion;
    return {
      respuesta:   `Por favor confirma: ¿deseas que te comunique con *${deptoLabel}*?\n\nToca una opción o escribe *sí* o *no*.`,
      nuevoEstado: conversacion.estado,
      teclado: await keyboards.get('CONFIRMAR_INTENCION', conversacion.empresa_id),
    };
  }

  // ── Etapa 2: selección de ambigüedad resuelta por callback ───────────────
  if (mensaje.startsWith('intencion:')) {
    const intencion = mensaje.split(':')[1];
    const DEPTO_MAP = {
      soporte:  DEPARTAMENTOS.SOPORTE,
      cobranza: DEPARTAMENTOS.COBRANZA,
      ventas:   DEPARTAMENTOS.VENTAS,
      asesor:   null,
    };
    return ejecutarIntencion({ intencion, depto: DEPTO_MAP[intencion] ?? null }, conversacion);
  }

  // ── Etapa 3: botones del menú (parseTipoCliente) ─────────────────────────
  const tipo = parseTipoCliente(mensaje);

  if (tipo === 'asesor') {
    return {
      respuesta:   '🧑‍💼 Claro, te ayudo a conectar con un asesor.\n\n¿Con qué área quieres hablar?',
      nuevoEstado: ESTADOS.SELECCION_AREA,
      teclado: await keyboards.get('AREAS', conversacion.empresa_id),
    };
  }

  if (tipo === 'soy_cliente') {
    return {
      respuesta:   '🔍 ¿Con qué dato deseas identificarte?',
      nuevoEstado: ESTADOS.IDENTIFICACION_DATOS,
      teclado: await keyboards.get('TIPO_IDENTIFICACION', conversacion.empresa_id),
    };
  }

  if (tipo === 'contratar') {
    return ejecutarIntencion({ intencion: 'ventas', depto: DEPARTAMENTOS.VENTAS }, conversacion);
  }

  // ── Etapa 4: NLU por texto libre ─────────────────────────────────────────
  const empresa_id = conversacion.empresa_id || '__todas__';
  const coincidentes = await detectarTodasCoincidentes(mensaje, empresa_id);

  if (coincidentes.length === 1) {
    const match = coincidentes[0];

    if (match.intencion === 'asesor') {
      return {
        respuesta:   '🧑‍💼 Entendido, quieres hablar con un asesor.\n\n¿Con qué área quieres hablar?',
        nuevoEstado: ESTADOS.SELECCION_AREA,
        teclado: await keyboards.get('AREAS', conversacion.empresa_id),
      };
    }

    // Área específica detectada → pedir confirmación antes de enrutar
    const deptoLabel = match.depto || match.intencion;
    meta.intencion_pendiente = { intencion: match.intencion, depto: match.depto };
    meta.intentos_fallidos   = 0;
    await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());

    return {
      respuesta:   `Entendí que necesitas ayuda con *${deptoLabel}*. ¿Es correcto?`,
      nuevoEstado: conversacion.estado,
      teclado: await keyboards.get('CONFIRMAR_INTENCION', conversacion.empresa_id),
    };
  }

  if (coincidentes.length >= 2) {
    // Quitar 'asesor' si hay intenciones de área más específicas
    const areas = coincidentes.filter(i => i.intencion !== 'asesor');
    const paraMenu = areas.length >= 2 ? areas : coincidentes;

    return {
      respuesta:   '🤔 Tu mensaje podría referirse a varias cosas. ¿Con cuál puedo ayudarte?',
      nuevoEstado: conversacion.estado,
      teclado:     keyboards.generarTecladoAmbiguo(paraMenu),
    };
  }

  // ── Sin coincidencias: contar intentos fallidos ───────────────────────────
  meta.intentos_fallidos = (meta.intentos_fallidos || 0) + 1;
  await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());

  if (meta.intentos_fallidos >= INTENTOS_MAX) {
    return {
      respuesta:   '🧑‍💼 Parece que tienes dudas. Te pongo en contacto con un asesor.\n\n¿Con qué área quieres hablar?',
      nuevoEstado: ESTADOS.SELECCION_AREA,
      teclado: await keyboards.get('AREAS', conversacion.empresa_id),
    };
  }

  return {
    respuesta:   '⚠️ No entendí tu respuesta. Por favor toca una de las opciones o escribe *"asesor"* para hablar con una persona.',
    nuevoEstado: conversacion.estado,
    teclado: await keyboards.get('TIPO_CLIENTE', conversacion.empresa_id),
  };
}

module.exports = { handle };
