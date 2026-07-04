/**
 * @file transferencia.service.js
 * @description Lógica de negocio para transferir un chat entre agentes/equipos.
 *
 * Caso 1 — Mismo equipo (cambio de turno):
 *   El chat se devuelve a la cola del mismo área. El agente actual se desasigna
 *   y el chat queda disponible para otro agente del mismo equipo.
 *   El historial completo es visible para el nuevo agente.
 *
 * Caso 2 — Otro equipo (cambio de área):
 *   El chat cambia de departamento. El agente actual se desasigna, el chat entra
 *   a la cola del área destino. El nuevo agente solo ve los mensajes a partir
 *   del momento de la transferencia (el frontend filtra por `transferida_en`).
 */

const db               = require('../config/db');
const conversacionRepo = require('../repositories/conversacion.repository');
const transferenciaRepo = require('../repositories/transferencia.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const { emitToConv }       = require('../utils/rooms');
const { detectarEscenario } = require('../utils/turnosHorarios');
const { enviarMensaje }     = require('../adapters');

/**
 * Transfiere un chat a la cola de un equipo (mismo o distinto).
 *
 * @param {object} params
 * @param {number} params.conversacion_id   - PK de la conversación a transferir.
 * @param {number} params.agente_id         - PK del agente que transfiere.
 * @param {string} params.agente_nombre     - Nombre del agente que transfiere.
 * @param {string} params.area_origen       - Área actual del agente.
 * @param {string} params.area_destino      - Área destino.
 * @param {string} params.nota              - Nota de contexto (obligatoria).
 * @param {import('socket.io').Server} params.io
 * @returns {Promise<{tipo: string, area_destino: string}>}
 */
async function transferir({ conversacion_id, agente_id, agente_nombre, area_origen, area_destino, nota, io }) {
  // Validar que la conversación existe y está asignada a este agente
  const { rows } = await db.query(
    `SELECT c.*, u.external_id, u.canal
     FROM conversaciones c
     JOIN usuarios u ON c.usuario_id = u.id
     WHERE c.id=$1`,
    [conversacion_id]
  );
  if (rows.length === 0) {
    const err = new Error('Conversación no encontrada');
    err.status = 404;
    throw err;
  }
  const conv = rows[0];

  if (!['atendiendo', 'ESPERANDO_AGENTE'].includes(conv.estado)) {
    const err = new Error('Solo se pueden transferir conversaciones activas');
    err.status = 400;
    throw err;
  }

  // Para admins sin área asignada, usar el departamento actual de la conversación
  const areaOrigenEfectiva = area_origen || conv.departamento || 'Sin área';
  const tipo = area_destino === areaOrigenEfectiva ? 'mismo_equipo' : 'entre_equipos';
  const esCambioEquipo = tipo === 'entre_equipos';

  // ── Actualizar la conversación ──────────────────────────────────────────────
  if (esCambioEquipo) {
    // Caso 2: cambia área, guarda timestamp y área origen para filtrar historial
    await db.query(
      `UPDATE conversaciones
       SET agente_id          = NULL,
           departamento       = $1,
           estado             = 'ESPERANDO_AGENTE',
           nota_transferencia = $2,
           transferida_en     = NOW(),
           transferida_desde  = $3,
           sla_pendiente_desde = NOW(),
           aviso_inactividad_enviado = 0,
           updated_at         = NOW()
       WHERE id=$4`,
      [area_destino, nota, conv.departamento, conversacion_id]
    );
  } else {
    // Caso 1: mismo área, solo desasignar agente y guardar nota
    await db.query(
      `UPDATE conversaciones
       SET agente_id          = NULL,
           estado             = 'ESPERANDO_AGENTE',
           nota_transferencia = $1,
           sla_pendiente_desde = NOW(),
           aviso_inactividad_enviado = 0,
           updated_at         = NOW()
       WHERE id=$2`,
      [nota, conversacion_id]
    );
  }

  // ── Insertar mensaje de sistema visible en el historial ────────────────────
  const bannerTexto = esCambioEquipo
    ? `🔀 Chat transferido a ${area_destino} por ${agente_nombre}. Nota: "${nota}"`
    : `🔄 Chat devuelto a cola de ${areaOrigenEfectiva} por ${agente_nombre} (cambio de turno). Nota: "${nota}"`;

  await mensajeRepo.create(conversacion_id, 'sistema_info', bannerTexto);

  // ── Registrar en el log de auditoría ───────────────────────────────────────
  const { rows: [registro] } = await transferenciaRepo.create({
    conversacion_id,
    empresa_id:           conv.empresa_id,
    agente_origen_id:     agente_id,
    agente_origen_nombre: agente_nombre,
    area_origen:          areaOrigenEfectiva,
    area_destino,
    tipo,
    nota,
  });

  // ── Verificar horario del área destino ─────────────────────────────────────
  // Si el área destino no tiene turno activo, avisar al cliente que está fuera de horario
  const { escenario: escHorario } = await detectarEscenario(db, new Date(), conv.empresa_id, area_destino, {});
  if (escHorario !== 'C') { // 'C' = turno activo; 'A'/'B' = festivo / fuera de turno
    try {
      const { rows: [cfg] } = await db.query(
        `SELECT valor FROM configuraciones WHERE clave='msg_fuera_horario' AND empresa_id=$1`,
        [conv.empresa_id]
      );
      const msgFuera = cfg?.valor || '⏰ Nuestro equipo no está disponible en este momento. Te atenderemos en horario de atención.';
      await enviarMensaje(conv.canal || 'telegram', conv.external_id, msgFuera, conv.empresa_id);
      await mensajeRepo.create(conversacion_id, 'bot', msgFuera);
    } catch { /* si falla el aviso, no interrumpir la transferencia */ }
  }

  // ── Emitir eventos Socket.IO ───────────────────────────────────────────────
  if (io) {
    const payload = {
      id:         conversacion_id,
      empresa_id: conv.empresa_id,
      estado:     'ESPERANDO_AGENTE',
      agente_id:  null,
      departamento: area_destino,
    };

    // Notificar al área origen + admin (el chat desaparece de la lista del agente)
    emitToConv(io, areaOrigenEfectiva, 'conversacion_actualizada', payload);

    // Notificar al área destino (el chat aparece en su cola), evitando doble emit a admin
    if (esCambioEquipo) {
      io.to(`area:${area_destino}`).emit('conversacion_actualizada', payload);
    }

    // El mensaje de sistema también se notifica en tiempo real
    emitToConv(io, area_destino, 'nuevo_mensaje', {
      conversacion_id,
      usuario_id:  conv.usuario_id,
      empresa_id:  conv.empresa_id,
      mensaje:     bannerTexto,
      remitente:   'sistema_info',
    });
  }

  return { tipo, area_destino, transferencia_id: registro.id };
}

/**
 * Marca como "tomada" la transferencia pendiente de una conversación.
 * Se llama desde chat.service cuando un agente del área destino envía el primer mensaje.
 *
 * @param {number} conversacion_id
 * @param {number} agente_id
 * @param {string} agente_nombre
 */
async function marcarTomada(conversacion_id, agente_id, agente_nombre) {
  const { rows } = await transferenciaRepo.findPendienteByConversacion(conversacion_id);
  if (rows.length === 0) return;
  await transferenciaRepo.markTomada(rows[0].id, agente_id, agente_nombre);
  // Limpiar la nota de transferencia ahora que fue tomada
  await db.query(
    'UPDATE conversaciones SET nota_transferencia=NULL WHERE id=$1 AND nota_transferencia IS NOT NULL',
    [conversacion_id]
  );
}

module.exports = { transferir, marcarTomada };
