const { Router } = require('express');
const ctrl       = require('../controllers/palabrasClave.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

const router = Router();

router.get   ('/',    verifyToken,              ctrl.listar);
router.post  ('/',    verifyToken, requireAdmin, ctrl.crear);
router.put   ('/:id', verifyToken, requireAdmin, ctrl.actualizar);
router.delete('/:id', verifyToken, requireAdmin, ctrl.eliminar);

module.exports = router;
