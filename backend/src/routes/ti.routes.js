/**
 * @file ti.routes.js
 * @description Rutas exclusivas del panel de TI.
 * Todas requieren verifyToken + requireTI.
 *
 *   GET  /ti/status          → estado del sistema
 *   POST /ti/mantenimiento   → activar/desactivar modo mantenimiento
 *   GET  /ti/backup          → descargar respaldo JSON
 *   GET  /ti/purga-preview   → contar mensajes elegibles para purga
 *   POST /ti/purgar          → ejecutar purga
 *   GET  /ti/logs            → últimos logs del servidor
 */

const express      = require('express');
const router       = express.Router();
const tiController = require('../controllers/ti.controller');
const { verifyToken, requireTI } = require('../middleware/auth.middleware');

const auth = [verifyToken, requireTI];

router.get ('/status',        ...auth, tiController.getStatus);
router.post('/mantenimiento', ...auth, tiController.setMantenimiento);
router.get ('/backup',        ...auth, tiController.descargarBackup);
router.get ('/purga-preview', ...auth, tiController.previewPurga);
router.post('/purgar',        ...auth, tiController.purgar);
router.get ('/logs',          ...auth, tiController.obtenerLogs);

module.exports = router;
