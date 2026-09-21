const express       = require('express');
const router        = express.Router();
const { verifyToken, requireAdminOrTI } = require('../middleware/auth.middleware');
const ctrl          = require('../controllers/permisos.controller');

router.get('/mi',   verifyToken, ctrl.getMios);
router.get('/:id',  verifyToken, requireAdminOrTI, ctrl.getDeUsuario);
router.put('/:id',  verifyToken, requireAdminOrTI, ctrl.setDeUsuario);

module.exports = router;
