const express      = require('express');
const router       = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const ctrl         = require('../controllers/rolTemplate.controller');

// GET accesible para todos los autenticados (necesario para pre-cargar al crear agente)
router.get('/',              verifyToken, ctrl.list);
router.get('/:rol',          verifyToken, ctrl.get);

// Escritura: solo admin
router.put('/:rol',          verifyToken, requireAdmin, ctrl.upsert);
router.post('/:rol/apply',   verifyToken, requireAdmin, ctrl.applyToRol);

module.exports = router;
