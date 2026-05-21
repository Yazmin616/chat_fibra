/**
 * @file conversaciones.routes.js
 * @description Definición de rutas para consulta de conversaciones y mensajes.
 * Este archivo solo registra las rutas; toda la lógica está en el controller.
 *
 * Rutas expuestas (todas requieren token válido):
 *   GET  /conversaciones/                   → Lista conversaciones (filtradas por rol/empresa)
 *   POST /conversaciones/marcar-leido/:id   → Marca mensajes como leídos
 *   GET  /conversaciones/por-usuario/:id    → Historial de mensajes de un usuario
 *   GET  /conversaciones/:id                → Mensajes de una conversación específica
 *
 * Nota: /marcar-leido y /por-usuario deben estar ANTES de /:id.
 */

const express                = require('express');
const router                 = express.Router();
const conversacionController = require('../controllers/conversacion.controller');
const { verifyToken }        = require('../middleware/auth.middleware');

router.get('/',                       verifyToken, conversacionController.listar);
router.post('/marcar-leido/:id',      verifyToken, conversacionController.marcarLeido);
router.get('/por-usuario/:usuarioId', verifyToken, conversacionController.getMensajesPorUsuario);
router.get('/:id',                    verifyToken, conversacionController.getMensajes);

module.exports = router;
