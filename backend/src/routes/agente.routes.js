/**
 * @file agente.routes.js
 * @description Definición de rutas para el panel de agentes.
 * Este archivo solo registra las rutas; toda la lógica está en los controllers.
 *
 * Permisos aplicados:
 *   GET    /agente/dashboard        → verifyToken (asesor ve su data, admin ve todo)
 *   POST   /agente/responder        → verifyToken
 *   POST   /agente/liberar          → verifyToken
 *   DELETE /agente/conversacion/:id → verifyToken + requireAdmin (borrado GDPR)
 *   GET    /agente/                 → verifyToken + requireAdmin
 *   POST   /agente/                 → verifyToken + requireAdmin
 *   DELETE /agente/:id              → verifyToken + requireAdmin
 *
 * Nota: /dashboard y /conversacion/:id deben estar ANTES de /:id para que Express
 * no los interprete como parámetros dinámicos.
 */

const express               = require('express');
const multer                = require('multer');
const router                = express.Router();
const agenteController      = require('../controllers/agente.controller');
const dashboardController   = require('../controllers/dashboard.controller');
const infraccionController  = require('../controllers/infraccion.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

// Multer en memoria: archivos nunca tocan el disco, se procesan directamente en RAM
// y se envían al canal externo (Telegram). Límite 16 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 16 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif',
                     'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Multer para avatares: solo imágenes, máximo 2 MB
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

// Proxy de archivos de Telegram.
// Sin auth: los navegadores no envían headers JWT en peticiones <img>/<video>/<audio>.
// Sirve el contenido directamente (sin redirect) para evitar ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
// que ocurre cuando el navegador sigue un 302 hacia un origen externo (api.telegram.org).
const https = require('https');
// Proxy de archivos de WhatsApp Business API.
// WhatsApp requiere Bearer token para descargar — el navegador no puede añadirlo
// en una etiqueta <audio src>, así que el backend lo añade y proxea el stream.
router.get('/wa-media/:empresa_id/:media_id', async (req, res, next) => {
  try {
    const { empresa_id, media_id } = req.params;
    const { resolveWaMediaUrl } = require('../adapters/meta');
    const { url, access_token } = await resolveWaMediaUrl(media_id, empresa_id);

    const parsedUrl = new URL(url);
    https.get(
      { hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'Authorization': `Bearer ${access_token}`, 'User-Agent': 'node-https' } },
      (upstream) => {
        if (upstream.statusCode !== 200) { res.status(upstream.statusCode || 502).end(); return; }
        res.setHeader('Content-Type',  upstream.headers['content-type']  || 'audio/ogg');
        res.setHeader('Content-Length', upstream.headers['content-length'] || '');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        upstream.pipe(res);
      }
    ).on('error', next);
  } catch (err) { next(err); }
});

router.get('/media/:empresa_id/:file_id', async (req, res, next) => {
  try {
    const { empresa_id, file_id } = req.params;
    const { resolveFileLink } = require('../adapters/telegram');
    const url = await resolveFileLink(file_id, empresa_id);

    https.get(url, (upstream) => {
      if (upstream.statusCode !== 200) {
        res.status(upstream.statusCode || 502).end();
        return;
      }
      res.setHeader('Content-Type',  upstream.headers['content-type']  || 'application/octet-stream');
      res.setHeader('Content-Length', upstream.headers['content-length'] || '');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      upstream.pipe(res);
    }).on('error', next);

  } catch (err) {
    next(err);
  }
});

router.get('/dashboard',                    verifyToken, dashboardController.getKpis);
router.get('/dashboard/calificaciones',     verifyToken, dashboardController.getCalificaciones);
router.get('/dashboard/asesor/:id',         verifyToken, requireAdmin, dashboardController.getAgenteStats);
router.get('/infracciones',                 verifyToken, requireAdmin, infraccionController.getInfracciones);
router.get('/infracciones/hoy',             verifyToken, requireAdmin, infraccionController.getConteoHoy);
router.post('/reaccionar', verifyToken, agenteController.reaccionar);

// Respuestas rápidas (personales de cada agente)
router.get   ('/respuestas-rapidas',     verifyToken, agenteController.listarRR);
router.post  ('/respuestas-rapidas',     verifyToken, agenteController.crearRR);
router.put   ('/respuestas-rapidas/:id', verifyToken, agenteController.actualizarRR);
router.delete('/respuestas-rapidas/:id', verifyToken, agenteController.eliminarRR);

router.post('/responder',          verifyToken,              agenteController.responder);
router.post('/enviar-media',       verifyToken,              upload.single('archivo'), agenteController.enviarMediaHandler);
router.post('/liberar',            verifyToken,              agenteController.liberar);
router.post('/escribiendo',        verifyToken,              agenteController.escribiendo);
router.delete('/conversacion/:id', verifyToken, requireAdmin, agenteController.eliminarConversacion);
router.get('/',                    verifyToken, requireAdmin, agenteController.listar);
router.post('/',                   verifyToken, requireAdmin, agenteController.crear);
router.patch('/:id/foto',          verifyToken, avatarUpload.single('foto'), agenteController.subirFoto);
router.put('/:id',                 verifyToken, requireAdmin, agenteController.actualizar);
router.delete('/:id',              verifyToken, requireAdmin, agenteController.eliminar);

module.exports = router;
