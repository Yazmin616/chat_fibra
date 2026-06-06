/**
 * @file seleccionArea.state.js
 * @description Manejador del estado SELECCION_AREA.
 *
 * El cliente elige área (Ventas, Cobranza, Soporte Técnico).
 *   1. Verifica si hay turno activo para el área antes de ponerlo en espera.
 *   2. Si no hay turno (escenario A/B): responde con mensaje de fuera de horario.
 *      La conversación permanece en SELECCION_AREA para que el cliente reintente.
 *   3. Si hay turno activo (escenario C):
 *      a. Cierra la conversación de menú (estado → CERRADA).
 *      b. Crea una nueva conversación limpia con estado ESPERANDO_AGENTE.
 *      c. Hace earlyReturn para que el adaptador use el nuevo conversacion_id.
 */

const conversacionRepo = require('../../repositories/conversacion.repository');
const mensajeRepo      = require('../../repositories/mensaje.repository');
const { parseDepto }   = require('../parsers');
const { ESTADOS }      = require('../constants');
const { AREAS }        = require('../keyboards');
const db               = require('../../config/db');
const logger           = require('../../config/logger');
const {
  detectarEscenario,
  formatearHorarios,
  proximoDiaHabil,
} = require('../../utils/turnosHorarios');

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

async function handle(mensaje, conversacion) {
  const depto = parseDepto(mensaje);

  if (depto) {
    // ── Verificar turno ANTES de crear la conversación en espera ────────────
    const empresaId = conversacion.empresa_id || 'fibratec';
    let configMap = {};
    try {
      const { rows } = await db.query(
        'SELECT clave, valor FROM configuraciones WHERE empresa_id=$1',
        [empresaId]
      );
      rows.forEach(r => { configMap[r.clave] = r.valor; });
    } catch (err) {
      logger.warn('[SELECCION_AREA] No se pudo cargar configMap:', err.message);
    }

    const { escenario, turnos } = await detectarEscenario(
      db, new Date(), empresaId, depto, configMap
    );

    if (escenario === 'A' || escenario === 'B') {
      // Fuera de horario: informar y mantener en SELECCION_AREA para reintentar
      const horarios = formatearHorarios(turnos);
      const proximo  = await proximoDiaHabil(db, empresaId, depto, configMap);
      const plantilla = escenario === 'A'
        ? (configMap.msg_festivo       || MSG_DEFAULT_FESTIVO)
        : (configMap.msg_fuera_horario || MSG_DEFAULT_FUERA_HORARIO);

      const texto = plantilla
        .replace(/\{horarios_atencion\}/g, horarios)
        .replace(/\{proximo_dia_habil\}/g,  proximo)
        .replace(/\{area\}/g,    depto)
        .replace(/\{empresa\}/g, empresaId);

      logger.info(
        `[ESCENARIO ${escenario}] ${depto} — sin turno activo — conversación cerrada, próximo mensaje inicia sesión nueva.`
      );

      // Cerrar la conversación: el próximo mensaje del cliente creará una nueva
      // desde cero (findActiveByUsuario excluye estado='cerrada').
      // Si sigue fuera de horario: repite el ciclo → una respuesta por intento, sin bucle.
      // Si ya hay turno activo: flujo normal como conversación nueva.
      return {
        earlyReturn: false,
        respuesta:   texto,
        nuevoEstado: ESTADOS.CERRADA,
        teclado:     null,
      };
    }

    // ── Escenario C: turno activo → crear conversación en espera ────────────
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

  return {
    earlyReturn: false,
    respuesta:   '⚠️ Opción no reconocida. Por favor elige un área:',
    nuevoEstado: conversacion.estado,
    teclado:     AREAS,
  };
}

module.exports = { handle };
