const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Obtener configuraciones de una empresa
router.get('/', async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const result = await db.query('SELECT * FROM configuraciones WHERE empresa_id = $1', [empresa_id || 'fibratec']);
    const configObj = {};
    result.rows.forEach(row => {
      configObj[row.clave] = row.valor;
    });
    res.json(configObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar o actualizar configuración por empresa
router.post('/', async (req, res) => {
  const { clave, valor, empresa_id } = req.body;
  try {
    // Usar ON CONFLICT para insertar o actualizar
    const query = `
      INSERT INTO configuraciones (clave, valor, empresa_id) 
      VALUES ($1, $2, $3)
      ON CONFLICT (clave, empresa_id) 
      DO UPDATE SET valor = EXCLUDED.valor;
    `;
    // Nota: Para que ON CONFLICT funcione, necesitamos un índice único compuesto (clave, empresa_id)
    await db.query(query, [clave, valor, empresa_id || 'fibratec']);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
