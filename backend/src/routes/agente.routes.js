/**
 * RUTAS DE AGENTE (DASHBOARD)
 * Este archivo define los endpoints que usa el panel de control (React)
 * para interactuar con los chats y los clientes.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enviarMensajeTelegram } = require('../adapters/telegram');

/* ========================
   RESPONDER (Agente -> Cliente)
   Envía un mensaje manual desde el panel al Telegram del usuario.
======================== */
router.post('/responder', async (req, res) => {
  try {
    const { conversacion_id, mensaje, user_id } = req.body;

    // 1. Guardar mensaje en la base de datos como remitente 'agente'
    await db.query(
      'INSERT INTO mensajes (conversacion_id, remitente, texto) VALUES ($1, $2, $3)',
      [conversacion_id, 'agente', mensaje]
    );

    // 2. Actualizar la fecha de actividad de la conversación
    await db.query('UPDATE conversaciones SET updated_at = NOW() WHERE id = $1', [conversacion_id]);

    // 3. Enviar el mensaje físicamente al adaptador de Telegram
    await enviarMensajeTelegram(user_id, mensaje);

    // 4. Notificar a través de Socket.io para actualizar otros paneles abiertos
    const io = req.app.get('io');
    io.emit('nuevo_mensaje', {
      conversacion_id,
      mensaje,
      remitente: 'agente'
    });

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al responder' });
  }
});

/* ========================
   LIBERAR (CERRAR CHAT CON MOTIVO)
   Finaliza la atención humana y activa la encuesta de satisfacción.
======================== */
router.post('/liberar', async (req, res) => {
  try {
    const { conversacion_id, motivo, agente_nombre } = req.body;

    // 0. Obtener el ID de Telegram para enviarle la encuesta
    const convData = await db.query(`
      SELECT c.id, u.external_id 
      FROM conversaciones c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = $1
    `, [conversacion_id]);

    if (convData.rows.length === 0) return res.status(404).json({ error: 'Conversación no encontrada' });
    const externalId = convData.rows[0].external_id;

    // 1. Cambiar estado a ENCUESTA_AGENTE para que el bot espere la calificación
    await db.query(
      'UPDATE conversaciones SET es_humano=false, estado=$1, motivo_cierre=$2, cerrado_por=$3, updated_at = NOW() WHERE id=$4',
      ['ENCUESTA_AGENTE', motivo || 'Finalización manual', agente_nombre || 'Agente', conversacion_id]
    );

    // 2. Insertar Banner Verde de sistema en el historial
    const bannerMsg = `Chat cerrado por: ${agente_nombre || 'Agente'} Motivo: ${motivo || 'cliente solucionado'}`;
    await db.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', 
      [conversacion_id, bannerMsg, 'sistema_success']);

    // 3. Enviar pregunta de encuesta vía Bot (DB + Telegram)
    const surveyText = `¿Cómo calificaría la atención de nuestro asesor ${agente_nombre || ''}? 🌟\n\nPor favor responda con un número:\n1️⃣ Mal\n2️⃣ Regular\n3️⃣ Bien`;
    
    await db.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', 
      [conversacion_id, surveyText, 'bot']);

    await enviarMensajeTelegram(externalId, surveyText);

    // 4. Notificar cambios en tiempo real al frontend
    const io = req.app.get('io');
    io.emit('nuevo_mensaje', { conversacion_id, mensaje: bannerMsg, remitente: 'sistema_success' });
    io.emit('nuevo_mensaje', { conversacion_id, mensaje: surveyText, remitente: 'bot' });
    io.emit('conversacion_actualizada', { id: conversacion_id, estado: 'ENCUESTA_AGENTE', es_humano: false });

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al liberar' });
  }
});

/* ========================
   ELIMINAR CHAT (Solo Pruebas)
======================== */
router.delete('/conversacion/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Eliminar mensajes primero por clave foránea
    await db.query('DELETE FROM mensajes WHERE conversacion_id = $1', [id]);
    await db.query('DELETE FROM conversaciones WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;