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
    // 'todas' is a frontend filter sentinel, not a real empresa — fall back to 'fibratec'.
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'fibratec';
    const { rows } = await db.query(
      'SELECT * FROM configuraciones WHERE empresa_id=$1',
      [eid]
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
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'fibratec';
    await db.query(
      `INSERT INTO configuraciones (clave, valor, empresa_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (clave, empresa_id) DO UPDATE SET valor=EXCLUDED.valor`,
      [clave, valor, eid]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// --- Plantillas Bot ---
const plantillasController = require('../controllers/plantillas.controller');

router.get('/plantillas', verifyToken, requireAdmin, plantillasController.getPlantillas);
router.post('/plantillas/:clave', verifyToken, requireAdmin, plantillasController.savePlantilla);

// --- Menús Bot ---
const menusController = require('../controllers/menus.controller');

router.get('/menus', verifyToken, requireAdmin, menusController.getMenus);
router.post('/menus/:menuId/:buttonId', verifyToken, requireAdmin, menusController.saveMenuButton);

module.exports = router;
