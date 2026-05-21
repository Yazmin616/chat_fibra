/**
 * @file agente.routes.js
 * @description Definición de rutas para el panel de agentes.
 * Este archivo solo registra las rutas; toda la lógica está en los controllers.
 *
 * Permisos aplicados:
 *   GET    /agente/dashboard        → verifyToken (asesor ve su data, admin ve todo)
 *   POST   /agente/responder        → verifyToken
 *   POST   /agente/liberar          → verifyToken
 *   DELETE /agente/conversacion/:id → verifyToken + requireAdmin (borrado GDPR)
 *   GET    /agente/                 → verifyToken + requireAdmin
 *   POST   /agente/                 → verifyToken + requireAdmin
 *   DELETE /agente/:id              → verifyToken + requireAdmin
 *
 * Nota: /dashboard y /conversacion/:id deben estar ANTES de /:id para que Express
 * no los interprete como parámetros dinámicos.
 */

const express               = require('express');
const router                = express.Router();
const agenteController      = require('../controllers/agente.controller');
const dashboardController   = require('../controllers/dashboard.controller');
const infraccionController  = require('../controllers/infraccion.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

// Proxy de archivos de Telegram.
// Sin auth: los navegadores no envían headers JWT en peticiones <img>/<video>.
// Seguridad: los file_id de Telegram son cadenas opacas de ~100 chars alfanuméricos.
router.get('/media/:empresa_id/:file_id', async (req, res, next) => {
  try {
    const { empresa_id, file_id } = req.params;
    const { resolveFileLink } = require('../adapters/telegram');
    const url = await resolveFileLink(file_id, empresa_id);
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard',                    verifyToken, dashboardController.getKpis);
router.get('/dashboard/calificaciones',     verifyToken, dashboardController.getCalificaciones);
router.get('/dashboard/asesor/:id',         verifyToken, requireAdmin, dashboardController.getAgenteStats);
router.get('/infracciones',                 verifyToken, requireAdmin, infraccionController.getInfracciones);
router.get('/infracciones/hoy',             verifyToken, requireAdmin, infraccionController.getConteoHoy);
router.post('/responder',          verifyToken,              agenteController.responder);
router.post('/liberar',            verifyToken,              agenteController.liberar);
router.post('/escribiendo',        verifyToken,              agenteController.escribiendo);
router.delete('/conversacion/:id', verifyToken, requireAdmin, agenteController.eliminarConversacion);
router.get('/',                    verifyToken, requireAdmin, agenteController.listar);
router.post('/',                   verifyToken, requireAdmin, agenteController.crear);
router.put('/:id',                 verifyToken, requireAdmin, agenteController.actualizar);
router.delete('/:id',              verifyToken, requireAdmin, agenteController.eliminar);

module.exports = router;
