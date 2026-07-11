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
const { verifyToken, requireAdmin, requireAdminOrCoordinator } = require('../middleware/auth.middleware');

// ── Áreas ────────────────────────────────────────────────────────────────────

router.get('/areas', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const isTodas = req.query.empresa_id === 'todas';
    const eid = _eid(req.query.empresa_id);
    
    let queryStr;
    let params;
    if (isTodas) {
      queryStr = `
        SELECT DISTINCT departamento AS area
        FROM conversaciones
        WHERE departamento IS NOT NULL
        UNION
        SELECT DISTINCT area
        FROM turnos
        WHERE area IS NOT NULL AND activo=true
        ORDER BY area`;
      params = [];
    } else {
      queryStr = `
        SELECT DISTINCT departamento AS area
        FROM conversaciones
        WHERE empresa_id=$1 AND departamento IS NOT NULL
        UNION
        SELECT DISTINCT area
        FROM turnos
        WHERE empresa_id=$1 AND area IS NOT NULL AND activo=true
        ORDER BY area`;
      params = [eid];
    }

    const { rows } = await db.query(queryStr, params);
    const areas = rows.map(r => r.area);
    if (req.agente.rol !== 'admin') {
      return res.json(areas.filter(a => req.agente.coordinadorAreas.includes(a)));
    }
    res.json(areas);
  } catch (err) { next(err); }
});

// ── Turnos ───────────────────────────────────────────────────────────────────

router.get('/turnos', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
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
    
    if (req.agente.rol !== 'admin') {
      return res.json(rows.filter(r => req.agente.coordinadorAreas.includes(r.area)));
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/turnos', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { empresa_id, area, nombre, hora_inicio, hora_fin, dias } = req.body;
    if (!nombre || !hora_inicio || !hora_fin || !dias) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, hora_inicio, hora_fin, dias' });
    }
    if (req.agente.rol !== 'admin' && (!area || !req.agente.coordinadorAreas.includes(area))) {
      return res.status(403).json({ error: 'No tienes permiso para crear turnos en esta área' });
    }
    const { rows: [t] } = await db.query(
      `INSERT INTO turnos (empresa_id, area, nombre, hora_inicio, hora_fin, dias)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [_eid(empresa_id), area || null, nombre, hora_inicio, hora_fin, dias]
    );
    res.status(201).json(t);
  } catch (err) { next(err); }
});

router.put('/turnos/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { nombre, hora_inicio, hora_fin, dias, activo, area } = req.body;
    
    // Si es coordinador, verificar que el turno actual pertenece a su área
    if (req.agente.rol !== 'admin') {
      const { rows: curr } = await db.query('SELECT area FROM turnos WHERE id=$1', [req.params.id]);
      if (!curr.length || !req.agente.coordinadorAreas.includes(curr[0].area)) {
        return res.status(403).json({ error: 'No tienes permiso para editar este turno' });
      }
      // También validar que no intente moverlo a un área que no coordina
      if (area && !req.agente.coordinadorAreas.includes(area)) {
         return res.status(403).json({ error: 'No tienes permiso para asignar este turno a esa área' });
      }
    }
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
router.delete('/turnos/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    if (req.agente.rol !== 'admin') {
      const { rows: curr } = await db.query('SELECT area FROM turnos WHERE id=$1', [req.params.id]);
      if (!curr.length || !req.agente.coordinadorAreas.includes(curr[0].area)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este turno' });
      }
    }
    await db.query('UPDATE turnos SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Festivos ─────────────────────────────────────────────────────────────────

router.get('/festivos', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const eid = _eid(req.query.empresa_id);
    const { rows } = await db.query(
      `SELECT * FROM festivos WHERE empresa_id=$1 ORDER BY fecha`,
      [eid]
    );
    if (req.agente.rol !== 'admin') {
      return res.json(rows.filter(r => !r.area || req.agente.coordinadorAreas.includes(r.area)));
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/festivos', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { empresa_id, fecha, nombre, area } = req.body;
    if (!fecha) return res.status(400).json({ error: 'El campo fecha es requerido' });
    if (req.agente.rol !== 'admin' && (!area || !req.agente.coordinadorAreas.includes(area))) {
      return res.status(403).json({ error: 'No tienes permiso para crear festivos globales o en esta área' });
    }
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

router.delete('/festivos/:id', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    if (req.agente.rol !== 'admin') {
      const { rows: curr } = await db.query('SELECT area FROM festivos WHERE id=$1', [req.params.id]);
      if (!curr.length || !curr[0].area || !req.agente.coordinadorAreas.includes(curr[0].area)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este festivo' });
      }
    }
    await db.query('DELETE FROM festivos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function _eid(v) {
  return (v && v !== 'todas') ? v : 'fibratec';
}

module.exports = router;
