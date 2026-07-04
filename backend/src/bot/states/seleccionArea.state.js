/**
 * @file seleccionArea.state.js
 * @description Manejador del estado SELECCION_AREA.
 *
 * El cliente elige área (Ventas, Cobranza, Soporte Técnico).
 *   1. Verifica si hay turno activo para el área antes de ponerlo en espera.
 *   2. Sin turno activo (escenario A/B): responde con mensaje de fuera de horario.
 *   3. Turno activo (escenario C): cierra la conv de menú, crea ESPERANDO_AGENTE.
 *
 * Fallback NLU: si parseDepto() no reconoce el input, se intenta detectarArea().
 * Tras 3 intentos fallidos consecutivos se auto-escala a Soporte Técnico.
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const { parseDepto }   = require('../parsers');
const { ESTADOS, DEPARTAMENTOS } = require('../constants');
const keyboards = require('../keyboards');
const { ConversacionMeta } = require('../conversacion.meta');
const { detectarArea } = require('../nlu');
const db               = require('../../config/db');
const logger           = require('../../config/logger');
const {
  detectarEscenario,
  formatearHorarios,
  proximoDiaHabil,
} = require('../../utils/turnosHorarios');
const { interpolarVars, nombreLimpio, buildMsgMantenimiento } = require('../../utils/vars');
const maintenance = require('../../maintenance');

const MSG_DEFAULT_FESTIVO = [
  '🎉 Hoy es día festivo. El equipo de *{area}* retoma actividades el *{proximo_dia_habil}*.',
  '',
  '🕐 Horarios habituales:',
  '{horarios_atencion}',
  '',
  'Puedes intentarlo de nuevo en ese momento.',
].join('\n');

const MSG_DEFAULT_FUERA_HORARIO = [
  '⏰ En este momento el equipo de *{area}* no está disponible.',
  '',
  '🕐 Horarios de atención:',
  '{horarios_atencion}',
  '',
  'Escríbenos cuando estemos en horario y te atenderemos con gusto. 😊',
].join('\n');

const INTENTOS_MAX = 3;

async function _escalarArea(depto, conversacion, mensaje) {
  const empresaId = conversacion.empresa_id || 'fibratec';
  let configMap = {};
  try {
    const { rows } = await db.query(
      'SELECT clave, valor FROM configuraciones WHERE empresa_id=$1', [empresaId]
    );
    rows.forEach(r => { configMap[r.clave] = r.valor; });
  } catch { /* non-critical */ }

  const { escenario, turnos } = await detectarEscenario(db, new Date(), empresaId, depto, configMap);

  if (escenario === 'A' || escenario === 'B') {
    const horarios = formatearHorarios(turnos);
    const proximo  = await proximoDiaHabil(db, empresaId, depto, configMap);
    const plantilla = escenario === 'A'
      ? (configMap.msg_festivo       || MSG_DEFAULT_FESTIVO)
      : (configMap.msg_fuera_horario || MSG_DEFAULT_FUERA_HORARIO);
    const texto = interpolarVars(plantilla, {
      nombre_cliente:    nombreLimpio(conversacion._usuario_nombre),
      empresa:           empresaId,
      area:              depto,
      horarios_atencion: horarios,
      proximo_dia_habil: proximo,
    });
    logger.info(`[ESCENARIO ${escenario}] ${depto} — sin turno activo.`);
    return { earlyReturn: false, respuesta: texto, nuevoEstado: ESTADOS.CERRADA, teclado: null };
  }

  if (maintenance.isActive()) {
    const texto = buildMsgMantenimiento(configMap, {
      nombre_cliente: nombreLimpio(conversacion._usuario_nombre),
      empresa:        empresaId,
      area:           depto,
    });
    return { earlyReturn: false, respuesta: texto, nuevoEstado: ESTADOS.CERRADA, teclado: null };
  }

  // Escenario C: conectar
  await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
  const nuevaConvId = (
    await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, depto)
  ).rows[0].id;

  const bannerCRM    = `CLIENTE EN ESPERA — ${depto}`;
  const confirmacion = `✅ Te estamos conectando con el área de *${depto}*.\n\nPuedes escribir tu consulta ahora y nuestro asesor la tendrá lista al atenderte. ¡Gracias por tu paciencia! 🙏`;

  await mensajeRepo.create(nuevaConvId, 'sistema_info', bannerCRM);
  await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);

  return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: depto } };
}

async function handle(mensaje, conversacion, usuario) {
  const depto = parseDepto(mensaje);

  if (depto) {
    const empresaId = conversacion.empresa_id || 'fibratec';
    let configMap = {};
    try {
      const { rows } = await db.query(
        'SELECT clave, valor FROM configuraciones WHERE empresa_id=$1', [empresaId]
      );
      rows.forEach(r => { configMap[r.clave] = r.valor; });
    } catch (err) {
      logger.warn('[SELECCION_AREA] No se pudo cargar configMap:', err.message);
    }

    const { escenario, turnos } = await detectarEscenario(db, new Date(), empresaId, depto, configMap);

    if (escenario === 'A' || escenario === 'B') {
      const horarios = formatearHorarios(turnos);
      const proximo  = await proximoDiaHabil(db, empresaId, depto, configMap);
      const plantilla = escenario === 'A'
        ? (configMap.msg_festivo       || MSG_DEFAULT_FESTIVO)
        : (configMap.msg_fuera_horario || MSG_DEFAULT_FUERA_HORARIO);
      const texto = interpolarVars(plantilla, {
        nombre_cliente:    nombreLimpio(usuario?.nombre),
        empresa:           empresaId,
        area:              depto,
        horarios_atencion: horarios,
        proximo_dia_habil: proximo,
      });
      logger.info(`[ESCENARIO ${escenario}] ${depto} — sin turno activo — conversación cerrada.`);
      return { earlyReturn: false, respuesta: texto, nuevoEstado: ESTADOS.CERRADA, teclado: null };
    }

    if (maintenance.isActive()) {
      const texto = buildMsgMantenimiento(configMap, {
        nombre_cliente: nombreLimpio(usuario?.nombre),
        empresa:        empresaId,
        area:           depto,
      });
      return { earlyReturn: false, respuesta: texto, nuevoEstado: ESTADOS.CERRADA, teclado: null };
    }

    // Escenario C
    await conversacionRepo.updateEstado(conversacion.id, ESTADOS.CERRADA);
    const nuevaConvId = (
      await conversacionRepo.createEsperando(conversacion.usuario_id, conversacion.empresa_id, depto)
    ).rows[0].id;

    const bannerCRM    = `CLIENTE EN ESPERA — ${depto}`;
    const confirmacion = `✅ Te estamos conectando con el área de *${depto}*.\n\nPuedes escribir tu consulta ahora y nuestro asesor la tendrá lista al atenderte. ¡Gracias por tu paciencia! 🙏`;

    await mensajeRepo.create(nuevaConvId, 'sistema_info', bannerCRM);
    await mensajeRepo.create(nuevaConvId, 'bot', confirmacion);

    return { earlyReturn: true, resultado: { texto: confirmacion, conversacion_id: nuevaConvId, departamento: depto } };
  }

  // ── Fallback NLU ────────────────────────────────────────────────────────────
  const empresa_id = conversacion.empresa_id || 'fibratec';
  const nlu = await detectarArea(mensaje, empresa_id);

  if (nlu?.depto) {
    // NLU detectó un área — tratar igual que si el cliente la hubiera elegido del menú
    const aviso = `🔍 Entendido. Te conectamos con *${nlu.depto}*...\n`;
    conversacion._usuario_nombre = usuario?.nombre;
    const resultado = await _escalarArea(nlu.depto, conversacion, mensaje);
    if (resultado.earlyReturn) {
      // Añadir aviso previo al mensaje de confirmación
      resultado.resultado.texto = aviso + resultado.resultado.texto;
      return resultado;
    }
    return resultado;
  }

  // ── Input no reconocido — incrementar intentos fallidos ────────────────────
  const meta = new ConversacionMeta(conversacion.metadata);
  meta.intentos_fallidos = (meta.intentos_fallidos || 0) + 1;
  await conversacionRepo.updateMetadata(conversacion.id, meta.toJSON());

  if (meta.intentos_fallidos >= INTENTOS_MAX) {
    // Auto-escalar a Soporte Técnico como área de último recurso
    const areaDefault = DEPARTAMENTOS.SOPORTE;
    const avisoEscalada = `Parece que tienes dificultades para elegir. Te comunico con un asesor de *${areaDefault}* ahora.\n\n`;
    conversacion._usuario_nombre = usuario?.nombre;
    const resultado = await _escalarArea(areaDefault, conversacion, mensaje);
    if (resultado.earlyReturn) {
      resultado.resultado.texto = avisoEscalada + resultado.resultado.texto;
      return resultado;
    }
    return { ...resultado, respuesta: avisoEscalada + resultado.respuesta };
  }

  const restantes = INTENTOS_MAX - meta.intentos_fallidos;
  const hint = restantes === 1
    ? '\n\n_Si necesitas ayuda, escribe "asesor" para hablar con una persona._'
    : '';

  return {
    earlyReturn: false,
    respuesta:   `⚠️ Opción no reconocida. Por favor elige un área tocando uno de los botones:${hint}`,
    nuevoEstado: conversacion.estado,
    teclado: await keyboards.get('AREAS', conversacion.empresa_id),
  };
}

module.exports = { handle };
