/**
 * @file chatInterno.socket.js
 * @description Manejador de eventos WebSockets para el Chat Interno Corporativo.
 * Control estricto de salas para miembros activos.
 */

const logger = require('../config/logger');
const db = require('../config/db');

function initChatInternoSockets(io) {
  io.on('connection', (socket) => {
    // Unirse a la sala de un canal específico (solo si es miembro activo)
    socket.on('chat_interno:join_canal', async ({ canalId, agenteId }) => {
      if (!canalId) return;
      const targetId = agenteId || socket.agenteId;

      if (targetId) {
        try {
          const { rows } = await db.query(
            'SELECT activo FROM chat_interno_miembros WHERE canal_id = $1 AND agente_id = $2',
            [canalId, targetId]
          );
          if (rows.length > 0 && rows[0].activo === false) {
            logger.debug(`[Socket] Agente ${targetId} intentó unirse al canal ${canalId} pero fue removido.`);
            socket.emit('chat_interno:acceso_denegado', { canalId, razon: 'removido' });
            return;
          }
        } catch (err) {
          logger.error('Error al verificar membresía en join_canal:', err);
        }
      }

      const room = `chat_interno:canal:${canalId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} (agente ${targetId}) se unió al canal interno: ${room}`);
    });

    // Salir de la sala del canal
    socket.on('chat_interno:leave_canal', ({ canalId }) => {
      if (!canalId) return;
      const room = `chat_interno:canal:${canalId}`;
      socket.leave(room);
      logger.debug(`Socket ${socket.id} salió del canal interno: ${room}`);
    });

    // Evento: un compañero está escribiendo
    socket.on('chat_interno:typing', ({ canalId, agenteNombre, agenteId }) => {
      if (!canalId) return;
      socket.broadcast.emit('chat_interno:typing', {
        canalId: Number(canalId),
        agenteNombre,
        agenteId: Number(agenteId || socket.agenteId)
      });
    });

    // Evento: dejó de escribir
    socket.on('chat_interno:stop_typing', ({ canalId, agenteId }) => {
      if (!canalId) return;
      socket.broadcast.emit('chat_interno:stop_typing', {
        canalId: Number(canalId),
        agenteId: Number(agenteId || socket.agenteId)
      });
    });

    // Evento: acuse de recibo / notificación de entrega de mensaje (2 palomitas grises)
    socket.on('chat_interno:ack_entrega', ({ canalId, mensajeId, emisorId }) => {
      if (!canalId || !mensajeId) return;
      io.emit('chat_interno:mensaje_entregado', {
        canalId: Number(canalId),
        mensajeId: Number(mensajeId),
        emisorId: Number(emisorId),
        entregadoA: Number(socket.agenteId)
      });
    });

    // Evento: cambio de estado de presencia (disponible, reunion, ocupado, comida, ausente)
    socket.on('agente:cambiar_presencia', async ({ estado, mensaje, agenteId }) => {
      const targetId = socket.agenteId || agenteId;
      if (!targetId) return;
      if (!socket.agenteId) socket.agenteId = Number(targetId);
      const agenteRepo = require('../repositories/agente.repository');
      const pollingService = require('../services/pollingService');
      try {
        await agenteRepo.setEstadoPresencia(targetId, estado, mensaje);
        const estaOnline = estado !== 'desconectado';
        if (estaOnline) {
          await agenteRepo.setOnline(targetId, true).catch(() => {});
          pollingService.setAgentOnline(targetId);
        } else {
          await agenteRepo.setOnline(targetId, false).catch(() => {});
          pollingService.setAgentOffline(targetId);
        }
        io.emit('agente:presencia_cambiada', {
          id: Number(targetId),
          estado_presencia: estado,
          mensaje_presencia: mensaje,
          esta_online: estaOnline
        });
        logger.info(`[Presencia] Agente ${targetId} cambió su estado a: ${estado} (online: ${estaOnline})`);
      } catch (err) {
        logger.error('Error al actualizar estado_presencia:', err);
      }
    });
  });

  logger.info('[Socket.io] Módulo de Chat Interno inicializado con validación de membresía');
}

module.exports = { initChatInternoSockets };
