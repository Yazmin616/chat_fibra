const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Listar todos los contactos (usuarios que han escrito)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.*,
        (SELECT MAX(created_at) FROM conversaciones WHERE usuario_id = u.id) as ultima_interaccion,
        (SELECT COUNT(*) FROM conversaciones WHERE usuario_id = u.id) as total_chats
      FROM usuarios u
      ORDER BY ultima_interaccion DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar contactos:", error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un contacto (por ejemplo, añadir teléfono manualmente)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono } = req.body;
  try {
    await db.query(
      'UPDATE usuarios SET nombre = $1, telefono = $2 WHERE id = $3',
      [nombre, telefono, id]
    );
    res.json({ message: "Contacto actualizado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
