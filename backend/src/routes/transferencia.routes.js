/**
 * @file transferencia.routes.js
 * @description Rutas para transferencia de chats y consulta del log de auditoría.
 *
 *   POST /transferencias/transferir           → cualquier agente autenticado
 *   GET  /transferencias/conversacion/:id     → cualquier agente autenticado
 *   GET  /transferencias                      → solo admin
 */

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/transferencia.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

router.post('/transferir',             verifyToken,              ctrl.transferirChat);
router.get ('/conversacion/:id',       verifyToken,              ctrl.getByConversacion);
router.get ('/',                       verifyToken, requireAdmin, ctrl.getAll);

module.exports = router;
