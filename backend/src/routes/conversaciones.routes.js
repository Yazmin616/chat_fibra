const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  const result = await db.query(`
    SELECT 
      c.id, 
      c.usuario_id,
      c.estado, 
      c.es_humano, 
      u.external_id,
      u.nombre,
      u.username,
      u.canal,
      (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as ultimo_mensaje,
      (SELECT created_at FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) as updated_at
    FROM conversaciones c
    JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY updated_at DESC NULLS LAST, c.id DESC
  `);

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