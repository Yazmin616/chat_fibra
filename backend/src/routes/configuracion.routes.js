const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Obtener todas las configuraciones
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuraciones');
    const config = {};
    result.rows.forEach(row => {
      config[row.clave] = row.valor;
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una configuración
router.post('/', async (req, res) => {
  const { clave, valor } = req.body;
  try {
    await pool.query(
      'INSERT INTO configuraciones (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2',
      [clave, valor]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
