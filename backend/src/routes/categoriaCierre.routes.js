const express = require('express');
const router  = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/categoriaCierre.controller');

// Listar: cualquier agente (backend filtra por rol/área del JWT)
// CRUD: solo admin
router.get('/',     verifyToken, ctrl.listar);
router.post('/',    verifyToken, requireAdmin, ctrl.crear);
router.put('/:id',  verifyToken, requireAdmin, ctrl.actualizar);
router.delete('/:id', verifyToken, requireAdmin, ctrl.eliminar);

module.exports = router;
