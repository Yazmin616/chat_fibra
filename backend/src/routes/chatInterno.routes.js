/**
 * @file chatInterno.routes.js
 * @description Rutas REST para el Módulo de Chat Interno Corporativo.
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { verifyToken } = require('../middleware/auth.middleware');
const chatInternoController = require('../controllers/chatInterno.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.use(verifyToken);

// Directorio y lista de canales / chats
router.get('/canales',                           chatInternoController.getCanales);
router.get('/contactos',                         chatInternoController.getContactos);
router.post('/directo',                          chatInternoController.abrirDirecto);
router.post('/canales',                          upload.single('foto'), chatInternoController.crearCanal);
router.put('/canales/:canalId',                  upload.single('foto'), chatInternoController.actualizarCanal);
router.delete('/canales/:canalId',                  chatInternoController.eliminarCanal);
router.post('/canales/:canalId/ocultar',           chatInternoController.ocultarConversacion);
router.post('/canales/:canalId/fijar',             chatInternoController.toggleFijarCanal);

// Mensajes y acciones del canal
router.get('/canales/:canalId/mensajes',         chatInternoController.getMensajes);
router.post('/canales/:canalId/mensajes',        upload.single('adjunto'), chatInternoController.enviarMensaje);
router.post('/canales/:canalId/leer',            chatInternoController.marcarLeido);

// Reacciones Emoji y Acciones de Mensajes
router.post('/mensajes/:mensajeId/reacciones',   chatInternoController.toggleReaccion);
router.put('/mensajes/:mensajeId',               chatInternoController.editarMensaje);
router.post('/mensajes/:mensajeId/fijar',         chatInternoController.toggleFijarMensaje);
router.post('/mensajes/:id/destacar',            chatInternoController.toggleDestacar);
router.delete('/mensajes/:mensajeId',            chatInternoController.eliminarMensaje);
router.get('/canales/:canalId/destacados',       chatInternoController.getMensajesDestacados);

// Panel de detalles y miembros del canal
router.get('/canales/:canalId/detalles',         chatInternoController.getDetalles);
router.post('/canales/:canalId/miembros',        chatInternoController.agregarMiembro);
router.put('/canales/:canalId/miembros/:agenteId/rol', chatInternoController.cambiarRolMiembro);
router.delete('/canales/:canalId/miembros/:agenteId', chatInternoController.removerMiembro);

module.exports = router;
