/**
 * @file rooms.js
 * @description Helper de Socket.io para emitir eventos solo a las salas relevantes
 * de una conversación, evitando que los agentes reciban eventos de otras áreas.
 *
 * Salas definidas:
 *   - 'admin'        → todos los agentes con rol 'admin'
 *   - 'area:Ventas'  → asesores del área Ventas
 *   - 'area:Cobranza'→ asesores del área Cobranza
 *   - 'area:Soporte Técnico' → asesores del área Soporte Técnico
 *
 * Los agentes se unen a su sala emitiendo 'agente:join' desde el frontend.
 */

/**
 * Emite un evento solo a las salas relevantes de una conversación:
 *   - Siempre a 'admin' (los admins ven todo).
 *   - Si la conversación tiene departamento, también a 'area:{departamento}'.
 *
 * @param {import('socket.io').Server} io          - Instancia de Socket.io.
 * @param {string|null|undefined}      departamento - Departamento de la conversación (puede ser null).
 * @param {string}                     event        - Nombre del evento a emitir.
 * @param {object}                     data         - Payload del evento.
 */
function emitToConv(io, departamento, event, data) {
  io.to('admin').emit(event, data);
  if (departamento) {
    io.to(`area:${departamento}`).emit(event, data);
  }
}

module.exports = { emitToConv };
