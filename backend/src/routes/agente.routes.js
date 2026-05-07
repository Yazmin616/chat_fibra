/**
 * RUTAS DE AGENTE (DASHBOARD)
 * Este archivo define los endpoints que usa el panel de control (React)
 * para interactuar con los chats y los clientes.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { enviarMensajeTelegram } = require('../adapters/telegram');

/* ========================
   RESPONDER (Agente -> Cliente)
   Envía un mensaje manual desde el panel al Telegram del usuario.
======================== */
router.post('/responder', async (req, res) => {
  try {
    const { conversacion_id, mensaje, user_id, agente_id } = req.body;

    // 1. Si la conversación no tiene agente, asignarla automáticamente y cambiar estado a 'atendiendo'
    await db.query(`
      UPDATE conversaciones 
      SET agente_id = COALESCE(agente_id, $1),
          estado = CASE WHEN estado = 'ESPERANDO_AGENTE' THEN 'atendiendo' ELSE estado END,
          updated_at = NOW()
      WHERE id = $2
    `, [agente_id, conversacion_id]);

    // 2. Guardar mensaje en la base de datos como remitente 'agente'
    await db.query(
      'INSERT INTO mensajes (conversacion_id, remitente, texto) VALUES ($1, $2, $3)',
      [conversacion_id, 'agente', mensaje]
    );

    // 3. Actualizar la fecha de actividad de la conversación
    await db.query('UPDATE conversaciones SET updated_at = NOW() WHERE id = $1', [conversacion_id]);

    // 4. Enviar el mensaje físicamente al adaptador de Telegram
    await enviarMensajeTelegram(user_id, mensaje);

    // 5. Notificar a través de Socket.io
    if (global.io) {
      // Obtenemos empresa_id y usuario_id para notificar
      const conv = await db.query('SELECT empresa_id, usuario_id FROM conversaciones WHERE id = $1', [conversacion_id]);
      const { empresa_id, usuario_id } = conv.rows[0] || {};

      global.io.emit('nuevo_mensaje', {
        conversacion_id,
        usuario_id,
        empresa_id,
        mensaje,
        remitente: 'agente',
        fecha: new Date()
      });
    }

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

    // 0. Obtener el ID de Telegram y empresa para notificar
    const convData = await db.query(`
      SELECT c.id, c.empresa_id, c.usuario_id, u.external_id 
      FROM conversaciones c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = $1
    `, [conversacion_id]);

    if (convData.rows.length === 0) return res.status(404).json({ error: 'Conversación no encontrada' });
    const { external_id, empresa_id, usuario_id } = convData.rows[0];

    // 1. Cambiar estado a ENCUESTA_AGENTE para que el bot espere la calificación
    await db.query(
      'UPDATE conversaciones SET es_humano=false, estado=$1, motivo_cierre=$2, cerrado_por=$3, updated_at = NOW() WHERE id=$4',
      ['ENCUESTA_AGENTE', motivo || 'Finalización manual', agente_nombre || 'Agente', conversacion_id]
    );

    // 2. Insertar Banner de sistema unificado
    const bannerMsg = `🏁 Finalización de chat: ${agente_nombre || 'Agente'} (${motivo || 'cliente solucionado'})`;
    await db.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', 
      [conversacion_id, bannerMsg, 'sistema_success']);

    // 3. Enviar pregunta de encuesta unificada
    const surveyText = `¿Cómo calificaría la atención recibida por parte de ${agente_nombre || 'nuestro asesor'}? 🌟\n\nResponda con un número:\n1️⃣ Mal\n2️⃣ Regular\n3️⃣ Bien`;
    
    await db.query('INSERT INTO mensajes (conversacion_id, texto, remitente) VALUES ($1, $2, $3)', 
      [conversacion_id, surveyText, 'bot']);

    await enviarMensajeTelegram(external_id, surveyText);

    // 4. Notificar cambios en tiempo real al frontend
    const io = req.app.get('io');
    if (io) {
      io.emit('nuevo_mensaje', { conversacion_id, usuario_id, empresa_id, mensaje: bannerMsg, remitente: 'sistema_success' });
      io.emit('nuevo_mensaje', { conversacion_id, usuario_id, empresa_id, mensaje: surveyText, remitente: 'bot' });
      io.emit('conversacion_actualizada', { id: conversacion_id, empresa_id, estado: 'ENCUESTA_AGENTE', es_humano: false });
    }

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al liberar' });
  }
});

// 1. Obtener lista de todos los agentes (Solo para Admins)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, nombre, email, rol, area, esta_online, created_at FROM agentes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Crear un nuevo agente
router.post('/', async (req, res) => {
  const { nombre, email, password, rol, area } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO agentes (nombre, email, password, rol, area) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email',
      [nombre, email, hashedPassword, rol, area]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Eliminar un agente
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Primero desvincular chats (poner agente_id en null)
    await db.query('UPDATE conversaciones SET agente_id = NULL WHERE agente_id = $1', [id]);
    await db.query('DELETE FROM agentes WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ========================
   ELIMINAR CHAT (Borrado Total)
   Elimina mensajes, calificaciones, la conversación y el usuario
   si no tiene más historial, sin dejar rastro.
======================== */
router.delete('/conversacion/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[DELETE] Iniciando borrado total para la conversación ID: ${id}`);
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 0. Obtener el usuario asociado a esta conversación
    const convRes = await client.query('SELECT usuario_id FROM conversaciones WHERE id = $1', [id]);
    
    if (convRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    
    const usuarioId = convRes.rows[0].usuario_id;
    console.log(`[DELETE] Borrando rastro del usuario: ${usuarioId}`);

    // 1. Obtener todas las conversaciones de este usuario para borrar sus hijos
    const allConvsRes = await client.query('SELECT id FROM conversaciones WHERE usuario_id = $1', [usuarioId]);
    const allIds = allConvsRes.rows.map(c => c.id);

    if (allIds.length > 0) {
      // 2. Borrar mensajes de TODAS las conversaciones del usuario
      await client.query('DELETE FROM mensajes WHERE conversacion_id = ANY($1)', [allIds]);
      console.log(`[DELETE] Mensajes borrados de ${allIds.length} conversaciones`);

      // 3. Borrar calificaciones de TODAS las conversaciones
      await client.query('DELETE FROM calificaciones WHERE conversacion_id = ANY($1)', [allIds]);
      
      // 4. Borrar las conversaciones
      await client.query('DELETE FROM conversaciones WHERE id = ANY($1)', [allIds]);
    }

    // 5. Borrar al usuario definitivamente
    await client.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
    console.log(`[DELETE] Usuario ${usuarioId} eliminado del sistema`);

    await client.query('COMMIT');

    // 6. Notificar a través de sockets
    if (global.io) {
      // Notificamos que la conversación específica se borró (para cerrar ventanas)
      // Y opcionalmente que el usuario ya no existe
      global.io.emit('conversacion_eliminada', { id, usuarioId });
    }
    
    res.json({ ok: true, message: 'Rastro eliminado por completo' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("[DELETE ERROR]", error);
    res.status(500).json({ 
      error: 'Error al eliminar rastro', 
      details: error.message 
    });
  } finally {
    client.release();
  }
});

/* ========================
   DASHBOARD DE KPIs Y EVALUACIONES
======================== */
/* ========================
   DASHBOARD DE KPIs Y EVALUACIONES
   ======================== */
router.get('/dashboard', async (req, res) => {
  const { agente_id, empresa_id } = req.query;
  const todas = empresa_id === 'todas';

  try {
    // Verificar si es admin
    let esAdmin = false;
    if (agente_id) {
      const agenteRes = await db.query('SELECT rol FROM agentes WHERE id = $1', [agente_id]);
      esAdmin = agenteRes.rows[0]?.rol === 'admin';
    }

    // Filtro base para queries
    const filtroAgente = esAdmin ? '' : `AND c.agente_id = ${agente_id}`;
    // Si no es admin, forzamos empresa. Si es admin y pide 'todas', no filtramos empresa.
    const filtroEmpresa = (esAdmin && todas) ? '' : `AND c.empresa_id = '${empresa_id || 'fibratec'}'`;

    // 1. KPIs: Chats atendidos por período
    const kpis = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE c.updated_at >= NOW() - INTERVAL '1 day') AS hoy,
        COUNT(*) FILTER (WHERE c.updated_at >= NOW() - INTERVAL '7 days') AS semana,
        COUNT(*) FILTER (WHERE c.updated_at >= NOW() - INTERVAL '30 days') AS mes,
        COUNT(*) FILTER (WHERE c.estado = 'cerrada') AS total_cerrados,
        COUNT(*) FILTER (WHERE c.estado = 'atendiendo' OR c.estado = 'ESPERANDO_AGENTE') AS activos
      FROM conversaciones c
      WHERE c.agente_id IS NOT NULL
      ${filtroEmpresa}
      ${filtroAgente}
    `);

    // 2. Calificaciones: Distribución (Bien / Regular / Mal)
    const calificaciones = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE cal.puntuacion = 'Bien') AS bien,
        COUNT(*) FILTER (WHERE cal.puntuacion = 'Regular') AS regular,
        COUNT(*) FILTER (WHERE cal.puntuacion = 'Mal') AS mal,
        COUNT(*) AS total
      FROM calificaciones cal
      JOIN conversaciones c ON cal.conversacion_id = c.id
      WHERE 1=1
      ${filtroEmpresa}
      ${filtroAgente}
    `);

    // 3. Actividad diaria (últimos 7 días)
    const actividadDiaria = await db.query(`
      SELECT
        TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City', 'DD/MM') AS dia,
        COUNT(*) AS chats
      FROM conversaciones c
      WHERE c.agente_id IS NOT NULL
        AND c.updated_at >= NOW() - INTERVAL '7 days'
        ${filtroEmpresa}
        ${filtroAgente}
      GROUP BY TO_CHAR(c.updated_at AT TIME ZONE 'America/Mexico_City', 'DD/MM'), 
               DATE_TRUNC('day', c.updated_at AT TIME ZONE 'America/Mexico_City')
      ORDER BY DATE_TRUNC('day', c.updated_at AT TIME ZONE 'America/Mexico_City') ASC
    `);

    // 4. Top Asesores (Solo Admin)
    let topAgentes = [];
    if (esAdmin) {
      const joinFilter = (esAdmin && todas) ? '' : `AND c.empresa_id = '${empresa_id || 'fibratec'}'`;
      const topRes = await db.query(`
        SELECT
          a.nombre,
          a.area,
          COUNT(c.id) AS total_chats,
          COUNT(c.id) FILTER (WHERE c.updated_at >= NOW() - INTERVAL '7 days') AS esta_semana,
          ROUND(
            COUNT(cal.id) FILTER (WHERE cal.puntuacion = 'Bien') * 100.0 / NULLIF(COUNT(cal.id), 0)
          , 0) AS satisfaccion_pct
        FROM agentes a
        LEFT JOIN conversaciones c ON c.agente_id = a.id ${joinFilter}
        LEFT JOIN calificaciones cal ON cal.conversacion_id = c.id
        WHERE a.rol = 'asesor'
        GROUP BY a.id, a.nombre, a.area
        ORDER BY total_chats DESC
      `);
      topAgentes = topRes.rows;
    }

    // 5. Últimas calificaciones individuales
    const ultimasCalificaciones = await db.query(`
      SELECT
        cal.puntuacion,
        cal.created_at,
        u.nombre AS cliente,
        a.nombre AS agente,
        c.departamento
      FROM calificaciones cal
      JOIN conversaciones c ON cal.conversacion_id = c.id
      JOIN usuarios u ON c.usuario_id = u.id
      LEFT JOIN agentes a ON c.agente_id = a.id
      WHERE 1=1
      ${filtroEmpresa}
      ${filtroAgente}
      ORDER BY cal.created_at DESC
      LIMIT 10
    `);

    res.json({
      kpis: kpis.rows[0],
      calificaciones: calificaciones.rows[0],
      actividadDiaria: actividadDiaria.rows,
      topAgentes,
      ultimasCalificaciones: ultimasCalificaciones.rows
    });

  } catch (error) {
    console.error('[DASHBOARD ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

module.exports = router;