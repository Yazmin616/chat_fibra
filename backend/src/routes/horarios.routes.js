/**
 * @file horarios.routes.js
 * @description CRUD de turnos por área y días festivos.
 *
 * Rutas expuestas (todas requieren token de administrador):
 *   GET    /horarios/areas           → áreas únicas usadas en turnos o conversaciones
 *   GET    /horarios/turnos          → todos los turnos de la empresa (filtrables por área)
 *   POST   /horarios/turnos          → crear turno
 *   PUT    /horarios/turnos/:id      → actualizar turno
 *   DELETE /horarios/turnos/:id      → desactivar turno (soft-delete)
 *   GET    /horarios/festivos        → lista de festivos
 *   POST   /horarios/festivos        → crear festivo
 *   DELETE /horarios/festivos/:id    → eliminar festivo
 */

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

// ── Áreas ────────────────────────────────────────────────────────────────────

router.get('/areas', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const eid = _eid(req.query.empresa_id);
    const { rows } = await db.query(
      `SELECT DISTINCT departamento AS area
       FROM conversaciones
       WHERE empresa_id=$1 AND departamento IS NOT NULL
       UNION
       SELECT DISTINCT area
       FROM turnos
       WHERE empresa_id=$1 AND area IS NOT NULL AND activo=true
       ORDER BY area`,
      [eid]
    );
    res.json(rows.map(r => r.area));
  } catch (err) { next(err); }
});

// ── Turnos ───────────────────────────────────────────────────────────────────

router.get('/turnos', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const eid  = _eid(req.query.empresa_id);
    const area = req.query.area || undefined;

    let q      = `SELECT * FROM turnos WHERE empresa_id=$1 AND activo=true`;
    const params = [eid];
    if (area !== undefined) {
      if (area === '') {
        q += ` AND area IS NULL`;
      } else {
        q += ` AND area=$2`;
        params.push(area);
      }
    }
    q += ` ORDER BY COALESCE(area, ''), hora_inicio`;

    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/turnos', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { empresa_id, area, nombre, hora_inicio, hora_fin, dias } = req.body;
    if (!nombre || !hora_inicio || !hora_fin || !dias) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, hora_inicio, hora_fin, dias' });
    }
    const { rows: [t] } = await db.query(
      `INSERT INTO turnos (empresa_id, area, nombre, hora_inicio, hora_fin, dias)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [_eid(empresa_id), area || null, nombre, hora_inicio, hora_fin, dias]
    );
    res.status(201).json(t);
  } catch (err) { next(err); }
});

router.put('/turnos/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { nombre, hora_inicio, hora_fin, dias, activo } = req.body;
    const { rows: [t] } = await db.query(
      `UPDATE turnos
       SET nombre=$1, hora_inicio=$2, hora_fin=$3, dias=$4, activo=$5
       WHERE id=$6
       RETURNING *`,
      [nombre, hora_inicio, hora_fin, dias, activo !== false, req.params.id]
    );
    if (!t) return res.status(404).json({ error: 'Turno no encontrado' });
    res.json(t);
  } catch (err) { next(err); }
});

// Soft-delete para preservar historial (los minutos laborales pasados ya se calcularon con este turno)
router.delete('/turnos/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    await db.query('UPDATE turnos SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Festivos ─────────────────────────────────────────────────────────────────

router.get('/festivos', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const eid = _eid(req.query.empresa_id);
    const { rows } = await db.query(
      `SELECT * FROM festivos WHERE empresa_id=$1 ORDER BY fecha`,
      [eid]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/festivos', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { empresa_id, fecha, nombre, area } = req.body;
    if (!fecha) return res.status(400).json({ error: 'El campo fecha es requerido' });
    const { rows: [f] } = await db.query(
      `INSERT INTO festivos (empresa_id, fecha, nombre, area)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [_eid(empresa_id), fecha, nombre || null, area || null]
    );
    res.status(201).json(f || { ok: true, msg: 'El festivo ya existía' });
  } catch (err) { next(err); }
});

router.delete('/festivos/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    await db.query('DELETE FROM festivos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function _eid(v) {
  return (v && v !== 'todas') ? v : 'fibratec';
}

module.exports = router;
