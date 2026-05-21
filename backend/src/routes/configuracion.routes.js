/**
 * @file configuracion.routes.js
 * @description Rutas para gestión de configuraciones del sistema por empresa.
 * Las configuraciones son pares clave-valor guardados en la tabla `configuraciones`.
 *
 * Ejemplo de configuración: { clave: "tiempo_inactividad", valor: "10", empresa_id: "fibratec" }
 *
 * Rutas expuestas (todas requieren token de administrador):
 *   GET  /configuracion?empresa_id=X → Obtiene todas las configs de una empresa como objeto { clave: valor }
 *   POST /configuracion              → Crea o actualiza un par clave-valor (upsert)
 */

const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

/**
 * Devuelve todas las configuraciones de una empresa como objeto plano.
 * Query param: empresa_id {string} (default "fibratec")
 */
router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { empresa_id } = req.query;
    const { rows } = await db.query(
      'SELECT * FROM configuraciones WHERE empresa_id=$1',
      [empresa_id || 'fibratec']
    );
    const configObj = {};
    rows.forEach(row => { configObj[row.clave] = row.valor; });
    res.json(configObj);
  } catch (err) { next(err); }
});

/**
 * Inserta o actualiza una configuración (upsert por clave+empresa_id).
 * Body esperado: { clave: string, valor: string, empresa_id: string }
 * Respuesta 200: { ok: true }
 */
router.post('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { clave, valor, empresa_id } = req.body;
    await db.query(
      `INSERT INTO configuraciones (clave, valor, empresa_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (clave, empresa_id) DO UPDATE SET valor=EXCLUDED.valor`,
      [clave, valor, empresa_id || 'fibratec']
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
