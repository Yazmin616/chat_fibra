const express      = require('express');
const router       = express.Router();
const { verifyToken, requireAdminOrTI } = require('../middleware/auth.middleware');
const ctrl         = require('../controllers/rolTemplate.controller');

// GET accesible para todos los autenticados (necesario para pre-cargar al crear agente)
router.get('/',              verifyToken, ctrl.list);
router.get('/:rol',          verifyToken, ctrl.get);

// Escritura: admin o ti
router.put('/:rol',          verifyToken, requireAdminOrTI, ctrl.upsert);
router.post('/:rol/apply',   verifyToken, requireAdminOrTI, ctrl.applyToRol);

module.exports = router;
