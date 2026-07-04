const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/flujo.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/:empresa_id/lista', verifyToken, ctrl.listFlujos);
router.get('/:empresa_id',       verifyToken, ctrl.getFlujo);
router.put('/:empresa_id',       verifyToken, ctrl.saveFlujo);
router.patch('/:id/activo',      verifyToken, ctrl.toggleActivo);

module.exports = router;
