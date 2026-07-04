const express       = require('express');
const router        = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const ctrl          = require('../controllers/permisos.controller');

router.get('/mi',   verifyToken, ctrl.getMios);
router.get('/:id',  verifyToken, requireAdmin, ctrl.getDeUsuario);
router.put('/:id',  verifyToken, requireAdmin, ctrl.setDeUsuario);

module.exports = router;
