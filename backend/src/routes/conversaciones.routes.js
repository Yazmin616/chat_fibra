const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  const { empresa_id } = req.query;
  const query = `
      SELECT * FROM (
        SELECT DISTINCT ON (c.usuario_id) 
          c.*, u.nombre, u.username, u.external_id,
          (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1) as ultimo_mensaje,
          (SELECT created_at FROM mensajes WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1) as ultimo_mensaje_fecha
        FROM conversaciones c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.empresa_id = $1
        ORDER BY c.usuario_id, c.created_at DESC
      ) t
      ORDER BY ultimo_mensaje_fecha DESC NULLS LAST, created_at DESC
    `;
  const result = await db.query(query, [empresa_id || 'fibratec']);

  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    'SELECT * FROM mensajes WHERE conversacion_id=$1 ORDER BY id ASC',
    [id]
  );

  res.json(result.rows);
});


router.get('/por-usuario/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  const result = await db.query(`
    SELECT m.* 
    FROM mensajes m
    JOIN conversaciones c ON m.conversacion_id = c.id
    WHERE c.usuario_id = $1
    ORDER BY m.id ASC
  `, [usuarioId]);

  res.json(result.rows);
});

module.exports = router;