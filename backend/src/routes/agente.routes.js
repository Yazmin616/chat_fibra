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
const { verifyToken, requireAdmin, requireAdminOrCoordinator } = require('../middleware/auth.middleware');

// Multer en memoria: archivos nunca tocan el disco, se procesan directamente en RAM
// y se envían al canal externo (Telegram). Límite 16 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 16 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif',
                     'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav',
                     'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Multer en memoria para media de respuestas rápidas (imágenes y PDF, máx. 8 MB)
const rrMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
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
// Sirve archivos de WhatsApp descargados al llegar el webhook.
// Primero intenta servir desde disco (uploads/wa-media/); si no existe (mensaje antiguo),
// hace un fallback descargando on-demand desde Meta. Nunca llama a next(err) para evitar
// que Helmet sobreescriba el header CORP con 'same-origin' en la respuesta de error.
const path   = require('path');
const fs     = require('fs');
const logger = require('../config/logger');

const WA_MEDIA_DIR   = path.join(__dirname, '../../uploads/wa-media');
const STICKERS_DIR   = path.join(__dirname, '../../uploads/stickers');

const EXT_TO_MIME = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  ogg:  'audio/ogg',  mp3: 'audio/mpeg', m4a: 'audio/mp4',  wav: 'audio/wav',
  mp4:  'video/mp4',  '3gp': 'video/3gpp',
  pdf:  'application/pdf',
  bin:  'application/octet-stream',
};

router.get('/wa-media/:empresa_id/:media_id', async (req, res) => {
  const { empresa_id, media_id } = req.params;

  // CORP header siempre primero — garantiza que incluso las respuestas de error
  // tengan 'cross-origin' y el navegador no bloquee por NotSameOrigin.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  try {
    // ── 1. Intentar servir desde disco ──────────────────────────────────────
    const dir = path.join(WA_MEDIA_DIR, empresa_id);
    let localFile = null;
    try {
      const files = await fs.promises.readdir(dir);
      const match = files.find(f => f.startsWith(media_id + '.'));
      if (match) localFile = path.join(dir, match);
    } catch { /* directorio aún no creado */ }

    if (localFile) {
      const ext  = localFile.split('.').pop().toLowerCase();
      const mime = EXT_TO_MIME[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      return res.sendFile(localFile);
    }

    // ── 2. Fallback: descargar on-demand desde Meta (mensajes anteriores) ───
    logger.info(`[WA-MEDIA] Archivo no en disco, descargando on-demand: ${empresa_id}/${media_id}`);
    const { resolveWaMediaUrl } = require('../adapters/meta');
    const { url, access_token } = await resolveWaMediaUrl(media_id, empresa_id);

    const upstream = await fetch(url, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!upstream.ok) {
      logger.warn(`[WA-MEDIA] Meta respondió ${upstream.status} para media_id=${media_id}`);
      return res.status(404).end();
    }

    const mime = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', mime);

    const { Readable } = require('stream');
    Readable.fromWeb(upstream.body).pipe(res);

  } catch (err) {
    logger.warn(`[WA-MEDIA] Archivo no disponible en Meta (probablemente expirado). media_id=${media_id} - ${err.message}`);
    // 404 controlado en lugar de 500 — CORP ya está seteado arriba
    res.status(404).end();
  }
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

// ── Sticker file server ──────────────────────────────────────────────────────
// Sin auth: peticiones <img> del navegador no envían headers JWT.
// Rutas de stickers va ANTES de /:id para que Express no lo interprete como ID.
router.get('/sticker-file/:pack/:file', (req, res) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  const safePack = path.basename(req.params.pack);
  const safeFile = path.basename(req.params.file);
  const filePath = path.join(STICKERS_DIR, safePack, safeFile);
  res.sendFile(filePath, (err) => { if (err) res.status(404).end(); });
});


// DELETE /agente/stickers/mine/:file — elimina un sticker personal del agente
router.delete('/stickers/mine/:file', verifyToken, async (req, res) => {
  const { agente_id } = req.body;
  if (!agente_id) return res.status(400).json({ error: 'Falta agente_id' });

  const pack     = `agente_${parseInt(agente_id)}`;
  const safeFile = path.basename(req.params.file);
  const filePath = path.join(STICKERS_DIR, pack, safeFile);

  try { await fs.promises.unlink(filePath); } catch (e) { if (e.code !== 'ENOENT') throw e; }

  const db = require('../config/db');
  await db.query(
    'DELETE FROM sticker_favoritos WHERE agente_id=$1 AND pack=$2 AND file=$3',
    [parseInt(agente_id), pack, safeFile]
  );

  logger.info(`[STICKER DELETE PERSONAL] agente_id=${agente_id} → ${pack}/${safeFile}`);
  res.json({ ok: true });
});

// GET /agente/stickers/favoritos — favoritos del agente (query: ?agente_id=)
router.get('/stickers/favoritos', verifyToken, async (req, res) => {
  const { agente_id } = req.query;
  if (!agente_id) return res.status(400).json({ error: 'Falta agente_id' });
  try {
    const db = require('../config/db');
    const { rows } = await db.query(
      'SELECT pack, file FROM sticker_favoritos WHERE agente_id=$1 ORDER BY created_at DESC',
      [parseInt(agente_id)]
    );
    res.json(rows);
  } catch (err) {
    logger.error('[STICKER FAV] Error al listar:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /agente/stickers/favorito — agregar favorito { agente_id, pack, file }
router.post('/stickers/favorito', verifyToken, async (req, res) => {
  const { agente_id, pack, file } = req.body;
  if (!agente_id || !pack || !file) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const db = require('../config/db');
    await db.query(
      'INSERT INTO sticker_favoritos(agente_id, pack, file) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [parseInt(agente_id), path.basename(pack), path.basename(file)]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error('[STICKER FAV] Error al agregar:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /agente/stickers/favorito — quitar favorito { agente_id, pack, file }
router.delete('/stickers/favorito', verifyToken, async (req, res) => {
  const { agente_id, pack, file } = req.body;
  if (!agente_id || !pack || !file) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const db = require('../config/db');
    await db.query(
      'DELETE FROM sticker_favoritos WHERE agente_id=$1 AND pack=$2 AND file=$3',
      [parseInt(agente_id), pack, file]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error('[STICKER FAV] Error al quitar:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /agente/stickers/save-from-wa — guarda un sticker recibido de un cliente (WA o Telegram)
router.post('/stickers/save-from-wa', verifyToken, async (req, res) => {
  const { agente_id, url_media } = req.body;
  if (!agente_id || !url_media) return res.status(400).json({ error: 'Faltan datos' });

  const isWa = url_media.startsWith('wa://');
  const isTg = url_media.startsWith('tg://');
  if (!isWa && !isTg) {
    return res.status(400).json({ error: 'Solo se pueden guardar stickers de WhatsApp o Telegram' });
  }

  try {
    const pack    = `agente_${parseInt(agente_id)}`;
    const destDir = path.join(STICKERS_DIR, pack);
    await fs.promises.mkdir(destDir, { recursive: true });

    let fileName;

    if (isWa) {
      // ── WhatsApp: el archivo ya está en disco (wa-media/) ─────────────────
      const rest       = url_media.slice(5);
      const slashIdx   = rest.indexOf('/');
      const empresa_id = rest.slice(0, slashIdx);
      const media_id   = rest.slice(slashIdx + 1);

      const waDir = path.join(WA_MEDIA_DIR, empresa_id);
      let srcPath = null;
      try {
        const files = await fs.promises.readdir(waDir);
        const match = files.find(f => f.startsWith(media_id + '.'));
        if (match) { srcPath = path.join(waDir, match); fileName = match; }
      } catch { /* directorio no encontrado */ }

      if (!srcPath) {
        return res.status(404).json({
          error: 'El sticker ya no está disponible en el servidor. Los archivos de WhatsApp se eliminan después de un tiempo.',
        });
      }

      const destPath = path.join(destDir, fileName);
      try { await fs.promises.access(destPath); }
      catch { await fs.promises.copyFile(srcPath, destPath); }

    } else {
      // ── Telegram: descargar desde Telegram API en el momento ──────────────
      const rest       = url_media.slice(5);
      const slashIdx   = rest.indexOf('/');
      const empresa_id = rest.slice(0, slashIdx);
      const file_id    = rest.slice(slashIdx + 1);

      const { resolveFileLink } = require('../adapters/telegram');
      const downloadUrl = await resolveFileLink(file_id, empresa_id);

      // Extraer extensión de la URL de Telegram (ej. ".webp" o ".webm")
      const urlExt = path.extname(new URL(downloadUrl).pathname) || '.webp';
      const safeName = file_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      fileName = `${safeName}${urlExt}`;
      const destPath = path.join(destDir, fileName);

      // Solo descargar si no existe ya (evitar re-descarga si el agente vuelve a pulsar)
      let alreadyExists = false;
      try { await fs.promises.access(destPath); alreadyExists = true; } catch { /**/ }

      if (!alreadyExists) {
        const resp = await fetch(downloadUrl);
        if (!resp.ok) {
          return res.status(502).json({ error: `No se pudo descargar el sticker de Telegram (${resp.status})` });
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        await fs.promises.writeFile(destPath, buffer);
      }
    }

    // Auto-favoritar (igual para ambos canales)
    const db = require('../config/db');
    await db.query(
      'INSERT INTO sticker_favoritos(agente_id, pack, file) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [parseInt(agente_id), pack, fileName]
    );

    logger.info(`[STICKER SAVE] agente_id=${agente_id} guardó ${isWa ? 'WA' : 'TG'} → ${pack}/${fileName}`);
    res.json({ ok: true, pack, file: fileName });
  } catch (err) {
    logger.error('[STICKER SAVE] Error:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /agente/stickers/create — crea y registra un sticker personalizado subido por el usuario
router.post('/stickers/create', verifyToken, upload.single('archivo'), async (req, res) => {
  const agente_id = req.agente?.id || req.body.agente_id;
  if (!agente_id) return res.status(400).json({ error: 'Falta agente_id' });
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo de sticker' });

  try {
    const pack = `agente_${parseInt(agente_id)}`;
    const destDir = path.join(STICKERS_DIR, pack);
    await fs.promises.mkdir(destDir, { recursive: true });

    const fileName = `stk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;
    const destPath = path.join(destDir, fileName);

    await fs.promises.writeFile(destPath, req.file.buffer);

    const db = require('../config/db');
    await db.query(
      'INSERT INTO sticker_favoritos(agente_id, pack, file) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [parseInt(agente_id), pack, fileName]
    );

    res.json({
      ok: true,
      pack,
      file: fileName,
      url: `/uploads/stickers/${pack}/${fileName}`
    });
  } catch (err) {
    logger.error('[STICKER CREATE] Error al crear sticker:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /agente/stickers — lista packs y archivos disponibles en uploads/stickers/
router.get('/stickers', verifyToken, async (req, res) => {
  try {
    let entries;
    try { entries = await fs.promises.readdir(STICKERS_DIR, { withFileTypes: true }); }
    catch { return res.json([]); }

    const packs = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const files = (await fs.promises.readdir(path.join(STICKERS_DIR, e.name)))
        .filter(f => /\.(webp|png|gif)$/i.test(f))
        .sort();
      if (files.length) packs.push({ pack: e.name, files });
    }
    res.json(packs);
  } catch (err) {
    logger.error('[STICKERS] Error listando stickers:', { error: err.message });
    res.status(500).json({ error: 'Error al listar stickers' });
  }
});

// POST /agente/sticker — el agente envía un sticker a un cliente de WhatsApp
router.post('/sticker', verifyToken, async (req, res) => {
  const { conversacion_id, agente_id, pack, file } = req.body;
  if (!conversacion_id || !pack || !file) {
    return res.status(400).json({ error: 'Faltan datos: conversacion_id, pack, file' });
  }

  const safePack = path.basename(pack);
  const safeFile = path.basename(file);
  const ext = path.extname(safeFile).slice(1).toLowerCase();
  if (ext !== 'webp') {
    return res.status(400).json({ error: `WhatsApp solo admite stickers .webp. El archivo "${safeFile}" es .${ext}. Sube una versión en formato WebP.` });
  }

  try {
    const db = require('../config/db');
    const { rows } = await db.query(
      `SELECT c.empresa_id, c.usuario_id, c.departamento, u.canal, u.external_id
       FROM conversaciones c JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.id = $1`,
      [conversacion_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Conversación no encontrada' });

    const { empresa_id, usuario_id, departamento, canal, external_id } = rows[0];
    if (canal !== 'whatsapp') {
      return res.status(400).json({ error: 'Los stickers solo están disponibles en conversaciones de WhatsApp' });
    }

    const filePath = path.join(STICKERS_DIR, safePack, safeFile);
    let fileBuffer;
    try { fileBuffer = await fs.promises.readFile(filePath); }
    catch { return res.status(404).json({ error: 'Sticker no encontrado en el servidor' }); }

    const { enviarStickerMeta } = require('../adapters/meta');
    await enviarStickerMeta(external_id, empresa_id, fileBuffer, safePack, safeFile);

    const mensajeRepo = require('../repositories/mensaje.repository');
    const url_media   = `st://${safePack}/${safeFile}`;
    const { rows: [savedMsg] } = await mensajeRepo.create(
      parseInt(conversacion_id), 'agente', '🎭 Sticker', 'sticker', url_media
    );
    const mensaje_id = savedMsg.id;

    const io = req.app.get('io');
    if (io) {
      const { emitToConv } = require('../utils/rooms');
      emitToConv(io, departamento, 'nuevo_mensaje', {
        conversacion_id: parseInt(conversacion_id),
        usuario_id, empresa_id,
        mensaje_id, mensaje: '🎭 Sticker', tipo: 'sticker',
        url_media, remitente: 'agente', estado: 'enviado', fecha: new Date(),
      });
    }

    res.json({ ok: true, mensaje_id });
  } catch (err) {
    logger.error('[STICKER] Error enviando sticker:', { error: err.message });
    res.status(500).json({ error: err.message || 'Error al enviar sticker' });
  }
});

router.get('/dashboard',                    verifyToken, dashboardController.getKpis);
router.get('/dashboard/calificaciones',     verifyToken, dashboardController.getCalificaciones);
router.get('/dashboard/asesor/:id',         verifyToken, requireAdmin, dashboardController.getAgenteStats);
router.get('/dashboard/nps',                verifyToken, requireAdminOrCoordinator, dashboardController.getNpsStats);
router.get('/dashboard/soluciones',         verifyToken, dashboardController.getSolucionesStaff);
router.get('/infracciones',                 verifyToken, requireAdminOrCoordinator, infraccionController.getInfracciones);
router.get('/infracciones/hoy',             verifyToken, requireAdminOrCoordinator, infraccionController.getConteoHoy);
router.post('/reaccionar', verifyToken, agenteController.reaccionar);

// Respuestas rápidas (personales de cada agente)
router.get   ('/respuestas-rapidas',        verifyToken,                                          agenteController.listarRR);
router.post  ('/respuestas-rapidas/usar',   verifyToken,                                          agenteController.usarRespuestaRapida);
router.post  ('/respuestas-rapidas',        verifyToken, rrMediaUpload.single('media'),            agenteController.crearRR);
router.put   ('/respuestas-rapidas/:id',    verifyToken, rrMediaUpload.single('media'),            agenteController.actualizarRR);
router.delete('/respuestas-rapidas/:id',    verifyToken,                                          agenteController.eliminarRR);

router.post('/responder',          verifyToken,              agenteController.responder);
router.post('/enviar-media',       verifyToken,              upload.single('archivo'), agenteController.enviarMediaHandler);
router.post('/liberar',            verifyToken,              agenteController.liberar);
router.post('/escribiendo',        verifyToken,              agenteController.escribiendo);
router.delete('/conversacion/:id', verifyToken, requireAdmin, agenteController.eliminarConversacion);
router.get('/directorio',          verifyToken,                            agenteController.directorio);
router.get('/',                    verifyToken, requireAdminOrCoordinator, agenteController.listar);
router.post('/',                   verifyToken, requireAdmin,              agenteController.crear);
router.patch('/:id/foto',          verifyToken, avatarUpload.single('foto'), agenteController.subirFoto);
router.put('/:id',                 verifyToken, requireAdmin,              agenteController.actualizar);
router.delete('/:id',              verifyToken, requireAdmin,              agenteController.eliminar);
router.post('/:id/reset-password-temporal', verifyToken, requireAdminOrCoordinator, agenteController.resetPasswordTemporal);

module.exports = router;
