/**
 * @file palabrasClave.controller.js
 * @description CRUD para el mapa de palabras clave del bot (tabla palabras_clave_bot).
 * Solo accesible para admin.
 */

const db   = require('../config/db');
const { invalidarCache } = require('../bot/nlu');
const logger = require('../config/logger');

/** GET /palabras-clave?empresa_id=xxx — listar reglas (todas o por empresa) */
async function listar(req, res) {
  try {
    const { empresa_id } = req.query;
    let rows;
    if (empresa_id) {
      ({ rows } = await db.query(
        `SELECT id, empresa_id, intencion, palabras, activo
         FROM palabras_clave_bot
         WHERE empresa_id = $1
         ORDER BY intencion`,
        [empresa_id]
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT id, empresa_id, intencion, palabras, activo
         FROM palabras_clave_bot
         ORDER BY empresa_id, intencion`
      ));
    }
    res.json(rows);
  } catch (err) {
    logger.error('[PALABRAS_CLAVE] listar:', err.message);
    res.status(500).json({ error: 'Error al obtener reglas' });
  }
}

/** PUT /palabras-clave/:id — actualizar palabras/activo de una regla */
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { palabras, activo } = req.body;

    if (!Array.isArray(palabras) || palabras.length === 0) {
      return res.status(400).json({ error: 'palabras debe ser un array no vacío' });
    }

    const clean = palabras.map(p => String(p).trim().toLowerCase()).filter(Boolean);
    const { rows } = await db.query(
      `UPDATE palabras_clave_bot
       SET palabras = $1, activo = $2
       WHERE id = $3
       RETURNING *`,
      [clean, activo !== false, id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Regla no encontrada' });
    invalidarCache(rows[0].empresa_id);
    res.json(rows[0]);
  } catch (err) {
    logger.error('[PALABRAS_CLAVE] actualizar:', err.message);
    res.status(500).json({ error: 'Error al actualizar regla' });
  }
}

/** POST /palabras-clave — crear una nueva regla */
async function crear(req, res) {
  try {
    const { empresa_id = '__todas__', intencion, palabras } = req.body;

    if (!intencion || !Array.isArray(palabras) || palabras.length === 0) {
      return res.status(400).json({ error: 'intencion y palabras son requeridos' });
    }

    const clean = palabras.map(p => String(p).trim().toLowerCase()).filter(Boolean);
    const { rows } = await db.query(
      `INSERT INTO palabras_clave_bot (empresa_id, intencion, palabras)
       VALUES ($1, $2, $3)
       ON CONFLICT (empresa_id, intencion) DO UPDATE
         SET palabras = EXCLUDED.palabras, activo = TRUE
       RETURNING *`,
      [empresa_id, intencion, clean]
    );

    invalidarCache(empresa_id);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error('[PALABRAS_CLAVE] crear:', err.message);
    res.status(500).json({ error: 'Error al crear regla' });
  }
}

/** DELETE /palabras-clave/:id — eliminar una regla */
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'DELETE FROM palabras_clave_bot WHERE id = $1 RETURNING empresa_id',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Regla no encontrada' });
    invalidarCache(rows[0].empresa_id);
    res.json({ ok: true });
  } catch (err) {
    logger.error('[PALABRAS_CLAVE] eliminar:', err.message);
    res.status(500).json({ error: 'Error al eliminar regla' });
  }
}

module.exports = { listar, actualizar, crear, eliminar };
