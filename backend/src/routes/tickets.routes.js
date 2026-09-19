/**
 * @file tickets.routes.js
 * @description Rutas de la API para gestión de Tickets de TI.
 */

const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/tickets.controller');
const { verifyToken, requireTI, requireAdmin } = require('../middleware/auth.middleware');

const requireTIOrAdmin = (req, res, next) => {
  if (!req.agente || (req.agente.rol !== 'ti' && req.agente.rol !== 'admin')) {
    return res.status(403).json({ error: 'Acceso restringido a personal de TI o Administrador' });
  }
  next();
};

// Rutas autenticadas (cualquier agente puede crear solicitudes o ver el estado)
router.use(verifyToken);

router.get('/stats', ticketsController.obtenerStats);
router.get('/', ticketsController.listar);
router.get('/:id', ticketsController.obtenerPorId);
router.post('/', ticketsController.crear);
router.put('/:id', ticketsController.actualizar);
router.delete('/:id', requireTIOrAdmin, ticketsController.eliminar);
router.post('/:id/comentarios', ticketsController.agregarComentario);

module.exports = router;
