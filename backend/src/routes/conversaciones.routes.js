const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Listar conversaciones (Dashboard)
router.get('/', async (req, res) => {
  const { empresa_id, agente_id } = req.query;
  const todas = empresa_id === 'todas';

  try {
    // Verificar rol del agente
    let esAdmin = false;
    let areaAgente = null;

    if (agente_id) {
      const agenteRes = await db.query('SELECT rol, area FROM agentes WHERE id = $1', [agente_id]);
      if (agenteRes.rows.length > 0) {
        esAdmin = agenteRes.rows[0].rol === 'admin';
        areaAgente = agenteRes.rows[0].area;
      }
    }

    if (esAdmin) {
      // =============================================
      // ADMIN: VE UNA SOLA ENTRADA POR USUARIO
      // Sin importar el área, cada cliente aparece una sola vez
      // =============================================
      const queryEmpresa = todas ? '' : `AND c.empresa_id = '${empresa_id || 'fibratec'}'`;
      const result = await db.query(`
        SELECT DISTINCT ON (c.usuario_id)
          c.*,
          u.nombre,
          u.username,
          u.external_id,
          u.canal,
          (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as ultimo_mensaje,
          (SELECT remitente FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as ultimo_remitente,
          (SELECT created_at FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as fecha_ultimo_mensaje,
          (SELECT COUNT(*) FROM mensajes WHERE conversacion_id = c.id AND remitente = 'user' AND leido = false) as no_leidos
        FROM conversaciones c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
          ${queryEmpresa}
        ORDER BY c.usuario_id, c.updated_at DESC
      `);

      const sorted = result.rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return res.json(sorted);

    } else {
      // =============================================
      // ASESOR: SOLO VE CONVERSACIONES DE SU ÁREA
      // =============================================
      const queryEmpresa = todas ? '' : `AND c.empresa_id = '${empresa_id || 'fibratec'}'`;
      const result = await db.query(`
        SELECT DISTINCT ON (c.usuario_id)
          c.*,
          u.nombre,
          u.username,
          u.external_id,
          u.canal,
          (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as ultimo_mensaje,
          (SELECT remitente FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as ultimo_remitente,
          (SELECT created_at FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as fecha_ultimo_mensaje,
          (SELECT COUNT(*) FROM mensajes WHERE conversacion_id = c.id AND remitente = 'user' AND leido = false) as no_leidos
        FROM conversaciones c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.departamento = $1
          ${queryEmpresa}
        ORDER BY c.usuario_id, c.updated_at DESC
      `, [areaAgente]);

      const sorted = result.rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return res.json(sorted);
    }

  } catch (error) {
    console.error("Error al listar conversaciones:", error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar mensajes como leídos
router.post('/marcar-leido/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener la conversación y su usuario
    const conv = await db.query(
      'SELECT empresa_id, usuario_id FROM conversaciones WHERE id = $1', [id]
    );
    if (conv.rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
    const { empresa_id, usuario_id } = conv.rows[0];

    // 2. Marcar como leídos los mensajes de TODAS las conversaciones de este usuario
    // Esto garantiza que el Admin (vista consolidada) también vea el contador en 0
    await db.query(`
      UPDATE mensajes SET leido = true 
      WHERE conversacion_id IN (
        SELECT id FROM conversaciones WHERE usuario_id = $1
      ) AND remitente = 'user' AND leido = false
    `, [usuario_id]);

    // 3. Emitir el evento con usuario_id para que TODOS los paneles lo procesen
    const io = req.app.get('io');
    if (io) {
      io.emit('conversacion_leida', { conversacion_id: id, usuario_id, empresa_id });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mensajes (CON AISLAMIENTO FÍSICO POR ID)
router.get('/por-usuario/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  const { agente_id, conversacion_id } = req.query;

  try {
    // 1. Obtener datos del agente (Rol)
    let esAdmin = false;
    if (agente_id) {
      const agenteRes = await db.query('SELECT rol FROM agentes WHERE id = $1', [agente_id]);
      if (agenteRes.rows.length > 0) {
        esAdmin = agenteRes.rows[0].rol === 'admin';
      }
    }

    if (esAdmin) {
      // ADMIN: Ve TODO el historial de este usuario (Une todos los IDs de conversación)
      const result = await db.query(`
        SELECT m.* 
        FROM mensajes m
        JOIN conversaciones c ON m.conversacion_id = c.id
        WHERE c.usuario_id = $1
        ORDER BY m.id ASC
      `, [usuarioId]);
      return res.json(result.rows);
    } else {
      // ASESOR: Ve el historial de SU ÁREA para este usuario
      if (conversacion_id) {
        // 1. Obtener el departamento de la conversación actual
        const convData = await db.query('SELECT departamento FROM conversaciones WHERE id = $1', [conversacion_id]);
        if (convData.rows.length > 0) {
          const area = convData.rows[0].departamento;
          
          // 2. Traer todos los mensajes de todas las conversaciones de este usuario en ESTA área
          const result = await db.query(`
            SELECT m.* 
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            WHERE c.usuario_id = $1 AND c.departamento = $2
            ORDER BY m.id ASC
          `, [usuarioId, area]);
          return res.json(result.rows);
        }
      }

      // Fallback: Si no hay conversacion_id o no se encontró área, solo lo básico
      const result = await db.query(`
        SELECT m.* 
        FROM mensajes m
        JOIN conversaciones c ON m.conversacion_id = c.id
        WHERE c.usuario_id = $1 AND c.id = $2
        ORDER BY m.id ASC
      `, [usuarioId, conversacion_id]);
      return res.json(result.rows);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM mensajes WHERE conversacion_id=$1 ORDER BY id ASC', [id]);
  res.json(result.rows);
});

module.exports = router;