const { Router } = require('express');
const ctrl = require('../controllers/areasSoluciones.controller');
const { verifyToken, requireAdmin, requireAdminOrCoordinator } = require('../middleware/auth.middleware');

const router = Router();

// Rutas protegidas para administradores y coordinadores
router.get('/', verifyToken, requireAdminOrCoordinator, ctrl.listarAreas);
router.post('/', verifyToken, requireAdminOrCoordinator, ctrl.crearArea);
router.put('/:id', verifyToken, requireAdminOrCoordinator, ctrl.actualizarArea);
router.delete('/:id', verifyToken, requireAdminOrCoordinator, ctrl.eliminarArea);

module.exports = router;
