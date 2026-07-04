const express = require('express');
const router  = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/etiqueta.controller');

// Catálogo — listar/crear: cualquier agente; editar/borrar: solo admin
router.get('/',    verifyToken, ctrl.listar);
router.post('/',   verifyToken, ctrl.crear);
router.put('/:id', verifyToken, requireAdmin, ctrl.actualizar);
router.delete('/:id', verifyToken, requireAdmin, ctrl.eliminar);

// Etiquetas de una conversación — cualquier agente autenticado puede asignar/quitar
router.get('/conversacion/:id',                  verifyToken, ctrl.getDeConversacion);
router.post('/conversacion/:id',                 verifyToken, ctrl.asignar);
router.delete('/conversacion/:id/:etiqueta_id',  verifyToken, ctrl.quitar);

module.exports = router;
