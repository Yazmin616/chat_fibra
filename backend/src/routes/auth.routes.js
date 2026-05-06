const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'fibratec_secret_2026';

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM agentes WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });

    const agente = result.rows[0];
    
    // En un sistema real usaríamos bcrypt.compare
    // Por simplicidad en este paso, comparamos directo o con bcrypt si ya está encriptado
    let valid = false;
    if (agente.password.startsWith('$2')) { // Es hash de bcrypt
       valid = await bcrypt.compare(password, agente.password);
    } else {
       valid = (password === agente.password); // Texto plano (solo para el admin inicial)
    }

    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Marcar como ONLINE al loguear
    await db.query('UPDATE agentes SET esta_online = true WHERE id = $1', [agente.id]);

    // Crear Token
    const token = jwt.sign(
      { id: agente.id, nombre: agente.nombre, rol: agente.rol, area: agente.area },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      agente: {
        id: agente.id,
        nombre: agente.nombre,
        rol: agente.rol,
        area: agente.area
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGOUT
router.post('/logout', async (req, res) => {
  const { agente_id } = req.body;
  try {
    await db.query('UPDATE agentes SET esta_online = false WHERE id = $1', [agente_id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
