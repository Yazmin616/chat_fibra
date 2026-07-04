/**
 * @file chat.service.js
 * @description Lógica de negocio para las operaciones de chat realizadas por los agentes:
 *   - responder: enviar un mensaje manual al cliente.
 *   - liberar:   cerrar el chat y lanzar la encuesta CSAT.
 *   - eliminar:  borrado total (GDPR) de todos los datos del usuario.
 *
 * Cada función recibe `io` (Socket.io) para emitir eventos en tiempo real al panel CRM.
 */

const path            = require('path');
const fsPromises      = require('fs').promises;
const db              = require('../config/db');
const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo     = require('../repositories/mensaje.repository');
const rrRepo          = require('../repositories/respuestaRapida.repository');
const { enviarMensaje, enviarMedia: enviarMediaAdapter } = require('../adapters');
const { emitToConv }  = require('../utils/rooms');
const { ENCUESTA }    = require('../bot/keyboards');
const { ESTADOS }     = require('../bot/constants');
const { marcarTomada } = require('./transferencia.service');

const WA_MEDIA_DIR = path.join(__dirname, '../../uploads/wa-media');
const RR_MEDIA_DIR = path.join(__dirname, '../../uploads/rr-media');

const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp', pdf: 'application/pdf',
};

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
async function responder({ conversacion_id, mensaje, agente_id, agente_nombre = null, user_id, io }) {
  await conversacionRepo.assignAgente(conversacion_id, agente_id);

  // marcarTomada necesita el nombre; si no viene del JWT lo buscamos en BD (fire-and-forget)
  const nombreFinal = agente_nombre || await db.query('SELECT nombre FROM agentes WHERE id=$1', [agente_id])
    .then(({ rows: [ag] }) => ag?.nombre || null)
    .catch(() => null);

  marcarTomada(conversacion_id, agente_id, nombreFinal).catch(() => {});

  // Guardar y obtener el ID del mensaje para rastrear su estado
  const { rows: [savedMsg] } = await mensajeRepo.create(
    conversacion_id, 'agente', mensaje, 'text', null, null, agente_id
  );
  const mensaje_id = savedMsg.id;

  await conversacionRepo.touch(conversacion_id);
  // El agente respondió — cancelar el reloj SLA pendiente
  db.query('UPDATE conversaciones SET sla_pendiente_desde=NULL WHERE id=$1', [conversacion_id])
    .catch(() => {});

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
      remitente:     'agente',
      agente_id,
      agente_nombre: nombreFinal,
      estado:        'enviado',
      fecha:         new Date()
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

  // Enviar por el canal y actualizar estado según la respuesta del adaptador
  const result = await enviarMensaje(canal || 'telegram', user_id, mensaje, empresa_id);
  if (result?.ok || result === true) {
    if (result?.wamid) {
      // WhatsApp: guardar wamid para correlacionar con status webhooks (sent/delivered/read).
      // El estado pasará de 'enviado' → 'entregado' → 'leido' cuando WhatsApp lo notifique.
      await db.query('UPDATE mensajes SET wamid=$1 WHERE id=$2', [result.wamid, mensaje_id]);
    } else {
      // Telegram y otros sin webhook de estado: marcar entregado inmediatamente.
      await mensajeRepo.updateEstado(mensaje_id);
      if (result?.telegram_msg_id) {
        await db.query('UPDATE mensajes SET telegram_msg_id=$1 WHERE id=$2', [result.telegram_msg_id, mensaje_id]);
      }
      if (io) emitToConv(io, departamento, 'mensaje_estado', { mensaje_id, conversacion_id, estado: 'entregado' });
    }
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
async function liberar({ conversacion_id, categoria_cierre_id, comentario_cierre, agente_nombre, agente_id, io }) {
  const { rows } = await db.query(
    `SELECT c.id, c.estado, c.empresa_id, c.usuario_id, c.departamento, u.external_id, u.canal
     FROM conversaciones c JOIN usuarios u ON c.usuario_id=u.id WHERE c.id=$1`,
    [conversacion_id]
  );
  if (rows.length === 0) {
    const err = new Error('Conversación no encontrada');
    err.status = 404;
    throw err;
  }

  // Idempotencia: ignorar si ya está en un estado de cierre/encuesta
  const ESTADOS_FINALES = [ESTADOS.ENCUESTA_AGENTE, ESTADOS.ENCUESTA_BOT, ESTADOS.CERRADA];
  if (ESTADOS_FINALES.includes(rows[0].estado)) {
    const err = new Error('La conversación ya está cerrada');
    err.status = 409;
    throw err;
  }

  const { external_id, empresa_id, usuario_id, departamento, canal } = rows[0];

  // Validación obligatoria: categoría + comentario para cierres manuales
  if (!categoria_cierre_id) {
    const err = new Error('Debes seleccionar una categoría de cierre');
    err.status = 400;
    throw err;
  }
  if (!comentario_cierre?.trim()) {
    const err = new Error('Debes escribir un comentario explicando la solución');
    err.status = 400;
    throw err;
  }

  // Obtener nombre de la categoría para el banner
  const { rows: [cat] } = await db.query(
    'SELECT nombre FROM categoria_cierre WHERE id=$1', [categoria_cierre_id]
  );
  const categoria_nombre = cat ? cat.nombre : 'Finalización manual';

  await conversacionRepo.liberar(
    conversacion_id,
    categoria_nombre,         // motivo_cierre (legado)
    agente_nombre || 'Agente',
    categoria_cierre_id,
    comentario_cierre,
    'manual',
    agente_id || null
  );

  const bannerMsg  = `Chat finalizado por ${agente_nombre || 'Agente'} — ${categoria_nombre}`;
  const surveyText = `¿Cómo calificarías la atención de ${agente_nombre || 'nuestro asesor'} hoy? 🌟`;

  await mensajeRepo.create(conversacion_id, 'sistema_success', bannerMsg);

  // Enviar el comentario de resolución al cliente
  if (comentario_cierre?.trim()) {
    const resolucionMsg = `✅ *Resolución:*\n\n${comentario_cierre.trim()}`;
    await mensajeRepo.create(conversacion_id, 'sistema_success', resolucionMsg);
    await enviarMensaje(canal || 'telegram', external_id, resolucionMsg, empresa_id);
    if (io) {
      emitToConv(io, departamento, 'nuevo_mensaje', {
        conversacion_id, usuario_id, empresa_id,
        mensaje: resolucionMsg, remitente: 'sistema_success',
      });
    }
  }

  await mensajeRepo.create(conversacion_id, 'bot', surveyText);
  await enviarMensaje(canal || 'telegram', external_id, surveyText, empresa_id, ENCUESTA);

  if (io) {
    emitToConv(io, departamento, 'nuevo_mensaje', { conversacion_id, usuario_id, empresa_id, mensaje: bannerMsg,  remitente: 'sistema_success' });
    emitToConv(io, departamento, 'nuevo_mensaje', { conversacion_id, usuario_id, empresa_id, mensaje: surveyText, remitente: 'bot' });
    emitToConv(io, departamento, 'conversacion_actualizada', { id: conversacion_id, empresa_id, estado: ESTADOS.ENCUESTA_AGENTE, es_humano: false });
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

/**
 * Envía una foto o nota de voz desde el agente al cliente y lo registra en DB.
 * El archivo llega como Buffer (procesado por multer en memoria).
 * Tras enviar a Telegram obtiene el file_id permanente y lo almacena como
 * url_media = "tg://empresa_id/file_id", igual que los mensajes entrantes.
 *
 * @param {object} params
 * @param {number} params.conversacion_id
 * @param {number} params.agente_id
 * @param {'photo'|'voice'} params.tipo
 * @param {Buffer} params.buffer
 * @param {string} params.caption          - Pie de foto (puede ser vacío).
 * @param {import('socket.io').Server} [params.io]
 */
async function enviarMedia({ conversacion_id, agente_id, agente_nombre = null, tipo, buffer, caption, io, filename = '', mimetype = '' }) {
  await conversacionRepo.assignAgente(conversacion_id, agente_id);

  const textoMensaje = tipo === 'voice'
    ? '🎤 Nota de voz'
    : tipo === 'document'
      ? `📎 ${filename || 'Documento'}`
      : (caption || '🖼 Imagen');

  // Guardar con url_media null; se actualiza tras confirmar envío al canal
  const { rows: [savedMsg] } = await mensajeRepo.create(
    conversacion_id, 'agente', textoMensaje, tipo, null, null, agente_id
  );
  const mensaje_id = savedMsg.id;

  await conversacionRepo.touch(conversacion_id);
  db.query('UPDATE conversaciones SET sla_pendiente_desde=NULL WHERE id=$1', [conversacion_id])
    .catch(() => {});

  const { rows } = await db.query(
    `SELECT c.empresa_id, c.usuario_id, c.departamento, c.estado, c.agente_id, u.canal, u.external_id
     FROM conversaciones c JOIN usuarios u ON c.usuario_id=u.id WHERE c.id=$1`,
    [conversacion_id]
  );
  const { empresa_id, usuario_id, departamento, estado, agente_id: agenteAsignado, canal, external_id } = rows[0] || {};

  if (io) {
    emitToConv(io, departamento, 'nuevo_mensaje', {
      conversacion_id, usuario_id, empresa_id,
      mensaje_id, mensaje: textoMensaje, tipo,
      url_media: null,
      remitente: 'agente', agente_id, agente_nombre,
      estado: 'enviado', fecha: new Date(),
    });
    emitToConv(io, departamento, 'conversacion_actualizada', {
      id: conversacion_id, empresa_id, estado, agente_id: agenteAsignado,
    });
  }

  const r = await enviarMediaAdapter(canal || 'telegram', external_id, buffer, tipo, caption, empresa_id, filename, mimetype);

  if (r.ok) {
    let url_media = null;

    if (r.file_id) {
      // Telegram: usa file_id permanente como referencia
      url_media = `tg://${empresa_id}/${r.file_id}`;
    } else if (['whatsapp', 'facebook', 'instagram'].includes(canal)) {
      // Meta: guardar buffer en disco para mostrarlo en el CRM
      try {
        const ext     = mimetype ? (mimetype.split('/')[1] || 'bin') : 'jpg';
        const outName = `out_${Date.now()}`;
        const dir     = path.join(WA_MEDIA_DIR, empresa_id);
        await fsPromises.mkdir(dir, { recursive: true });
        await fsPromises.writeFile(path.join(dir, `${outName}.${ext}`), buffer);
        url_media = `wa://${empresa_id}/${outName}`;
      } catch (e) {
        require('../config/logger').warn('[CHAT] No se pudo guardar media Meta a disco:', e.message);
      }
    }

    if (url_media) {
      await db.query(
        `UPDATE mensajes SET estado='entregado', url_media=$1 WHERE id=$2`,
        [url_media, mensaje_id]
      );
      if (io) {
        emitToConv(io, departamento, 'mensaje_estado', {
          mensaje_id, conversacion_id, estado: 'entregado', url_media,
        });
      }
    }
  }
}

/**
 * Envía una respuesta rápida (con o sin media adjunta) al cliente.
 * Para media: lee el archivo del disco y llama al adaptador de canal.
 * Para texto: equivale a responder() pero sin pasar por el input del agente.
 *
 * @param {object} params
 * @param {number} params.conversacion_id
 * @param {number} params.rr_id          - PK de la respuesta rápida.
 * @param {number} params.agente_id
 * @param {import('socket.io').Server} params.io
 */
async function enviarRespuestaRapida({ conversacion_id, rr_id, agente_id, agente_nombre = null, io }) {
  const rr = await rrRepo.findById(rr_id, agente_id);
  if (!rr) {
    const err = new Error('Respuesta rápida no encontrada');
    err.status = 404;
    throw err;
  }

  await conversacionRepo.assignAgente(conversacion_id, agente_id);

  const nombreFinal = agente_nombre || await db.query('SELECT nombre FROM agentes WHERE id=$1', [agente_id])
    .then(({ rows: [ag] }) => ag?.nombre || null)
    .catch(() => null);

  marcarTomada(conversacion_id, agente_id, nombreFinal).catch(() => {});

  const { rows } = await db.query(
    `SELECT c.empresa_id, c.usuario_id, c.departamento, c.estado, c.agente_id AS agenteAsig,
            u.canal, u.external_id
     FROM conversaciones c JOIN usuarios u ON c.usuario_id=u.id WHERE c.id=$1`,
    [conversacion_id]
  );
  const conv = rows[0];
  if (!conv) throw Object.assign(new Error('Conversación no encontrada'), { status: 404 });

  await conversacionRepo.touch(conversacion_id);
  db.query('UPDATE conversaciones SET sla_pendiente_desde=NULL WHERE id=$1', [conversacion_id])
    .catch(() => {});

  if (rr.tipo_media && rr.url_media) {
    // ── Respuesta con media ─────────────────────────────────────────────────
    // rr.url_media = "rr://agente_id/filename"
    const relativePath = rr.url_media.slice(5); // "agente_id/filename"
    const filePath     = path.join(RR_MEDIA_DIR, relativePath);

    let buffer;
    try {
      buffer = await fsPromises.readFile(filePath);
    } catch {
      const err = new Error('El archivo de la respuesta rápida ya no existe en el servidor');
      err.status = 404;
      throw err;
    }

    const ext      = path.extname(rr.nombre_archivo || relativePath).slice(1).toLowerCase();
    const mimetype = EXT_TO_MIME[ext] || 'application/octet-stream';
    const caption  = rr.contenido || '';
    const texto    = rr.tipo_media === 'image'
      ? (caption || '🖼 Imagen')
      : `📎 ${rr.nombre_archivo || 'Documento'}`;

    const { rows: [savedMsg] } = await mensajeRepo.create(
      conversacion_id, 'agente', texto, rr.tipo_media, rr.url_media, null, agente_id
    );
    const mensaje_id = savedMsg.id;

    if (io) {
      emitToConv(io, conv.departamento, 'nuevo_mensaje', {
        conversacion_id, usuario_id: conv.usuario_id, empresa_id: conv.empresa_id,
        mensaje_id, mensaje: texto, tipo: rr.tipo_media,
        url_media: rr.url_media, remitente: 'agente', estado: 'enviado', fecha: new Date(),
        agente_id, agente_nombre: nombreFinal,
      });
      emitToConv(io, conv.departamento, 'conversacion_actualizada', {
        id: conversacion_id, empresa_id: conv.empresa_id,
        estado: conv.estado, agente_id: conv.agenteAsig,
      });
    }

    // Enviar al canal externo (en segundo plano para no bloquear la respuesta)
    enviarMediaAdapter(
      conv.canal, conv.external_id, buffer, rr.tipo_media,
      caption, conv.empresa_id, rr.nombre_archivo || 'archivo', mimetype
    ).then(r => {
      if (r.ok && !r.file_id) return; // Meta: archivo ya servido desde disco vía rr://
      if (r.ok && r.file_id) {
        // Telegram: actualizar con file_id para proxy
        const url_media = `tg://${conv.empresa_id}/${r.file_id}`;
        db.query(`UPDATE mensajes SET estado='entregado', url_media=$1 WHERE id=$2`, [url_media, mensaje_id])
          .catch(() => {});
        if (io) emitToConv(io, conv.departamento, 'mensaje_estado', { mensaje_id, conversacion_id, estado: 'entregado', url_media });
      }
    }).catch(() => {});

  } else if (rr.contenido) {
    // ── Respuesta solo texto ────────────────────────────────────────────────
    const { rows: [savedMsg] } = await mensajeRepo.create(
      conversacion_id, 'agente', rr.contenido, 'text', null, null, agente_id
    );
    const mensaje_id = savedMsg.id;

    if (io) {
      emitToConv(io, conv.departamento, 'nuevo_mensaje', {
        conversacion_id, usuario_id: conv.usuario_id, empresa_id: conv.empresa_id,
        mensaje_id, mensaje: rr.contenido, tipo: 'text',
        url_media: null, remitente: 'agente', estado: 'enviado', fecha: new Date(),
        agente_id, agente_nombre: nombreFinal,
      });
      emitToConv(io, conv.departamento, 'conversacion_actualizada', {
        id: conversacion_id, empresa_id: conv.empresa_id,
        estado: conv.estado, agente_id: conv.agenteAsig,
      });
    }

    enviarMensaje(conv.canal, conv.external_id, rr.contenido, conv.empresa_id)
      .then(result => {
        const entregado = result?.ok !== false;
        db.query(`UPDATE mensajes SET estado=$1 WHERE id=$2`, [entregado ? 'entregado' : 'error', mensaje_id])
          .catch(() => {});
        if (io && entregado) {
          emitToConv(io, conv.departamento, 'mensaje_estado', { mensaje_id, conversacion_id, estado: 'entregado' });
        }
      }).catch(() => {});
  } else {
    throw Object.assign(new Error('La respuesta rápida no tiene contenido ni media'), { status: 400 });
  }
}

module.exports = { responder, liberar, eliminar, enviarMedia, enviarRespuestaRapida };
