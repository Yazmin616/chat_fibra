/**
 * @file chat.service.js
 * @description Lógica de negocio para las operaciones de chat realizadas por los agentes:
 *   - responder: enviar un mensaje manual al cliente.
 *   - liberar:   cerrar el chat y lanzar la encuesta CSAT.
 *   - eliminar:  borrado total (GDPR) de todos los datos del usuario.
 *
 * Cada función recibe `io` (Socket.io) para emitir eventos en tiempo real al panel CRM.
 */

const db              = require('../config/db');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo     = require('../repositories/mensaje.repository');
const { enviarMensaje } = require('../adapters');
const { emitToConv }  = require('../utils/rooms');

/**
 * Envía un mensaje de un agente al cliente por Telegram y lo registra en DB.
 * Si la conversación está en ESPERANDO_AGENTE, la pasa automáticamente a "atendiendo"
 * y asigna el agente (si aún no tiene uno).
 *
 * @param {object} params
 * @param {number} params.conversacion_id - PK de la conversación.
 * @param {string} params.mensaje         - Texto a enviar.
 * @param {number} params.agente_id       - PK del agente que envía el mensaje.
 * @param {string} params.user_id         - ID externo del cliente en Telegram (para envío físico).
 * @param {import('socket.io').Server} [params.io] - Socket.io para notificar el mensaje al dashboard.
 * @returns {Promise<void>}
 */
async function responder({ conversacion_id, mensaje, agente_id, user_id, io }) {
  await conversacionRepo.assignAgente(conversacion_id, agente_id);

  // Guardar y obtener el ID del mensaje para rastrear su estado
  const { rows: [savedMsg] } = await mensajeRepo.create(conversacion_id, 'agente', mensaje);
  const mensaje_id = savedMsg.id;

  await conversacionRepo.touch(conversacion_id);

  // Obtener empresa_id, departamento, canal y estado actual (puede haber cambiado a 'atendiendo')
  const { rows } = await db.query(
    `SELECT c.empresa_id, c.usuario_id, c.departamento, c.estado, c.agente_id, u.canal
     FROM conversaciones c JOIN usuarios u ON c.usuario_id=u.id WHERE c.id=$1`,
    [conversacion_id]
  );
  const { empresa_id, usuario_id, departamento, estado, agente_id: agenteAsignado, canal } = rows[0] || {};

  // Notificar al dashboard con estado inicial 'enviado'
  if (io) {
    emitToConv(io, departamento, 'nuevo_mensaje', {
      conversacion_id,
      usuario_id,
      empresa_id,
      mensaje_id,
      mensaje,
      remitente: 'agente',
      estado:    'enviado',
      fecha:     new Date()
    });
  }

  // Notificar a todos los agentes del área que la conversación fue tomada.
  // Esto permite que otros asesores actualicen su lista y no vean la conv como libre.
  if (io) {
    emitToConv(io, departamento, 'conversacion_actualizada', {
      id:         conversacion_id,
      empresa_id,
      estado,
      agente_id:  agenteAsignado,
    });
  }

  // Enviar por el canal correspondiente; si tiene éxito → actualizar a 'entregado'
  const entregado = await enviarMensaje(canal || 'telegram', user_id, mensaje, empresa_id);
  if (entregado) {
    await mensajeRepo.updateEstado(mensaje_id);
    if (io) emitToConv(io, departamento, 'mensaje_estado', { mensaje_id, conversacion_id, estado: 'entregado' });
  }
}

/**
 * Libera el chat: marca la conversación como finalizada (es_humano=false, estado=ENCUESTA_AGENTE),
 * inserta un banner de cierre, envía la encuesta CSAT al cliente por Telegram y notifica el dashboard.
 *
 * @param {object} params
 * @param {number} params.conversacion_id - PK de la conversación a liberar.
 * @param {string} [params.motivo]        - Motivo del cierre (texto libre).
 * @param {string} [params.agente_nombre] - Nombre del agente que cierra.
 * @param {import('socket.io').Server} [params.io] - Socket.io para actualizar el dashboard.
 * @throws {Error} 404 si la conversación no existe.
 * @returns {Promise<void>}
 */
async function liberar({ conversacion_id, motivo, agente_nombre, solucion, io }) {
  const { rows } = await db.query(
    `SELECT c.id, c.empresa_id, c.usuario_id, c.departamento, u.external_id, u.canal
     FROM conversaciones c JOIN usuarios u ON c.usuario_id=u.id WHERE c.id=$1`,
    [conversacion_id]
  );
  if (rows.length === 0) {
    const err = new Error('Conversación no encontrada');
    err.status = 404;
    throw err;
  }
  const { external_id, empresa_id, usuario_id, departamento, canal } = rows[0];

  await conversacionRepo.liberar(
    conversacion_id,
    motivo        || 'Finalización manual',
    agente_nombre || 'Agente'
  );

  const bannerMsg  = `Chat finalizado por ${agente_nombre || 'Agente'} — ${motivo || 'consulta resuelta'}`;
  const surveyText = `¿Cómo calificarías la atención de *${agente_nombre || 'nuestro asesor'}* hoy? 🌟\n\n1️⃣  Mala\n2️⃣  Regular\n3️⃣  Buena\n\nEscribe el número de tu calificación.`;

  await mensajeRepo.create(conversacion_id, 'sistema_success', bannerMsg);

  // Si el agente escribió una solución, registrarla y enviarla al cliente
  if (solucion && solucion.trim()) {
    const solucionMsg = `✅ *Solución brindada:*\n\n${solucion.trim()}`;
    await mensajeRepo.create(conversacion_id, 'sistema_success', solucionMsg);
    await enviarMensaje(canal || 'telegram', external_id, solucionMsg, empresa_id);
    if (io) {
      emitToConv(io, departamento, 'nuevo_mensaje', {
        conversacion_id, usuario_id, empresa_id,
        mensaje: solucionMsg, remitente: 'sistema_success',
      });
    }
  }

  await mensajeRepo.create(conversacion_id, 'bot', surveyText);
  await enviarMensaje(canal || 'telegram', external_id, surveyText, empresa_id);

  if (io) {
    emitToConv(io, departamento, 'nuevo_mensaje', { conversacion_id, usuario_id, empresa_id, mensaje: bannerMsg,  remitente: 'sistema_success' });
    emitToConv(io, departamento, 'nuevo_mensaje', { conversacion_id, usuario_id, empresa_id, mensaje: surveyText, remitente: 'bot' });
    emitToConv(io, departamento, 'conversacion_actualizada', { id: conversacion_id, empresa_id, estado: 'ENCUESTA_AGENTE', es_humano: false });
  }
}

/**
 * Borrado acotado por empresa: elimina en cascada todos los mensajes, calificaciones
 * y conversaciones del usuario DENTRO de la empresa de la conversación indicada.
 *
 * El registro del usuario (tabla `usuarios`) solo se borra si, tras la eliminación,
 * el usuario no tiene ninguna otra conversación en ninguna empresa. Esto preserva
 * correctamente los datos del mismo usuario en otras empresas del sistema.
 *
 * Ejemplo: si el usuario tiene conversaciones en Fibratec y Compusemmm, y un agente
 * de Fibratec borra la conversación de Fibratec, solo se eliminan los datos de
 * Fibratec. Los datos de Compusemmm permanecen intactos.
 *
 * @param {object} params
 * @param {number} params.conversacion_id - PK de la conversación a borrar (determina la empresa).
 * @param {import('socket.io').Server} [params.io] - Socket.io para notificar a los paneles.
 * @throws {Error} 404 si la conversación no existe.
 * @returns {Promise<void>}
 */
async function eliminar({ conversacion_id, io }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Obtener usuario, empresa y departamento de la conversación a eliminar
    const convRes = await client.query(
      'SELECT usuario_id, empresa_id, departamento FROM conversaciones WHERE id=$1',
      [conversacion_id]
    );
    if (convRes.rows.length === 0) {
      const err = new Error('Conversación no encontrada');
      err.status = 404;
      throw err;
    }
    const { usuario_id: usuarioId, empresa_id: empresaId, departamento } = convRes.rows[0];

    // Obtener solo las conversaciones de ESA empresa para este usuario
    const convsEmpresaRes = await client.query(
      'SELECT id FROM conversaciones WHERE usuario_id=$1 AND empresa_id=$2',
      [usuarioId, empresaId]
    );
    const idsEmpresa = convsEmpresaRes.rows.map(c => c.id);

    if (idsEmpresa.length > 0) {
      await client.query('DELETE FROM mensajes       WHERE conversacion_id=ANY($1)', [idsEmpresa]);
      await client.query('DELETE FROM calificaciones WHERE conversacion_id=ANY($1)', [idsEmpresa]);
      await client.query('DELETE FROM conversaciones WHERE id=ANY($1)',              [idsEmpresa]);
    }

    // Borrar el usuario solo si ya no tiene conversaciones en ninguna otra empresa
    const restoRes = await client.query(
      'SELECT 1 FROM conversaciones WHERE usuario_id=$1 LIMIT 1',
      [usuarioId]
    );
    if (restoRes.rows.length === 0) {
      await client.query('DELETE FROM usuarios WHERE id=$1', [usuarioId]);
    }

    await client.query('COMMIT');

    if (io) emitToConv(io, departamento, 'conversacion_eliminada', { id: conversacion_id, usuarioId, empresaId });

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { responder, liberar, eliminar };
