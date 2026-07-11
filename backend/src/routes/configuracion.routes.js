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
const { verifyToken, requireAdmin, requireAdminOrCoordinator } = require('../middleware/auth.middleware');

/**
 * Devuelve todas las configuraciones de una empresa como objeto plano.
 * Query param: empresa_id {string} (default "fibratec")
 */
router.get('/', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { empresa_id, area } = req.query;
    // Map 'todas' (from frontend) to 'todas' (in database).
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'todas';
    
    // Si no es admin y pide un área, verificar que coordine esa área
    if (req.agente.rol !== 'admin' && area && !req.agente.coordinadorAreas.includes(area)) {
      return res.status(403).json({ error: 'No coordinas esta área' });
    }

    const { rows } = await db.query(
      'SELECT * FROM configuraciones WHERE (empresa_id=$1 OR empresa_id=$2) AND (area=$3 OR area=$4)',
      [eid, 'todas', '', area || '']
    );
    
    const configObj = {};
    
    // Merge order (more specific overrides less specific):
    // 1. Global / All companies, general area (empresa_id='todas', area='')
    rows.filter(r => r.empresa_id === 'todas' && r.area === '').forEach(row => {
      configObj[row.clave] = row.valor;
    });

    // 2. Global / All companies, specific area (empresa_id='todas', area=area)
    if (area) {
      rows.filter(r => r.empresa_id === 'todas' && r.area === area).forEach(row => {
        configObj[row.clave] = row.valor;
      });
    }

    // 3. Company-specific, general area (empresa_id=eid, area='')
    if (eid !== 'todas') {
      rows.filter(r => r.empresa_id === eid && r.area === '').forEach(row => {
        configObj[row.clave] = row.valor;
      });
    }

    // 4. Company-specific, specific area (empresa_id=eid, area=area)
    if (eid !== 'todas' && area) {
      rows.filter(r => r.empresa_id === eid && r.area === area).forEach(row => {
        configObj[row.clave] = row.valor;
      });
    }
    
    // Inyectar el ID de teléfono configurado en el .env (solo lectura para el frontend)
    const envKey = `META_${eid.toUpperCase()}_WHATSAPP_PHONE_ID`;
    configObj.env_whatsapp_phone_id = process.env[envKey] || null;

    res.json(configObj);
  } catch (err) { next(err); }
});

/**
 * Devuelve un resumen de la configuración de Meta para todas las empresas.
 * Usado en la vista "Todas las empresas" del panel de configuración.
 */
router.get('/resumen-meta', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT empresa_id, clave, valor 
      FROM configuraciones 
      WHERE clave LIKE 'meta_%' OR clave = 'wa_message_limit_margin'
    `);
    const resumen = {};
    rows.forEach(r => {
      if (!resumen[r.empresa_id]) resumen[r.empresa_id] = {};
      resumen[r.empresa_id][r.clave] = r.valor;
    });
    
    // Convertir a array e inyectar el valor del .env para cada empresa
    const data = Object.keys(resumen).map(emp => {
      const envKey = `META_${emp.toUpperCase()}_WHATSAPP_PHONE_ID`;
      return {
        empresa_id: emp,
        env_whatsapp_phone_id: process.env[envKey] || null,
        ...resumen[emp]
      };
    });
    
    // Además, hay que revisar si en el .env hay empresas que no tengan registros en la BD
    Object.keys(process.env).forEach(key => {
      const match = key.match(/^META_(.+)_WHATSAPP_PHONE_ID$/);
      if (match) {
        const emp = match[1].toLowerCase();
        if (!resumen[emp]) {
          data.push({
            empresa_id: emp,
            env_whatsapp_phone_id: process.env[key]
          });
        }
      }
    });

    res.json(data);
  } catch (err) { next(err); }
});

/**
 * Inserta o actualiza una configuración (upsert por clave+empresa_id).
 * Body esperado: { clave: string, valor: string, empresa_id: string }
 * Respuesta 200: { ok: true }
 */
router.post('/', verifyToken, requireAdminOrCoordinator, async (req, res, next) => {
  try {
    const { clave, valor, empresa_id, area } = req.body;
    const eid = (empresa_id && empresa_id !== 'todas') ? empresa_id : 'todas';
    const targetArea = area || '';

    // Validar que la empresa exista en la base de datos
    const { rows: empCheck } = await db.query('SELECT 1 FROM empresas WHERE id = $1', [eid]);
    if (empCheck.length === 0) {
      return res.status(400).json({ error: `La empresa '${eid}' no existe o no es válida.` });
    }

    if (req.agente.rol !== 'admin') {
      if (!targetArea) return res.status(403).json({ error: 'Coordinadores no pueden modificar configuraciones globales' });
      if (!req.agente.coordinadorAreas.includes(targetArea)) return res.status(403).json({ error: 'No coordinas esta área' });
    }

    await db.query(
      `INSERT INTO configuraciones (clave, valor, empresa_id, area)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (clave, empresa_id, area) DO UPDATE SET valor=EXCLUDED.valor`,
      [clave, valor, eid, targetArea]
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
