/**
 * @file agente.controller.js
 * @description Controlador HTTP para operaciones de agentes y acciones de chat.
 * Todas las funciones validan el body con Joi, delegan a los servicios correspondientes
 * y devuelven la respuesta HTTP. Los errores se propagan via next(err).
 *
 * Rutas asociadas (ver agente.routes.js):
 *   GET    /agente/             → listar()
 *   POST   /agente/             → crear()
 *   DELETE /agente/:id          → eliminar()
 *   POST   /agente/responder    → responder()
 *   POST   /agente/liberar      → liberar()
 *   DELETE /agente/conversacion/:id → eliminarConversacion()
 *   GET    /agente/directorio       → directorio()
 */

const path          = require('path');
const fs            = require('fs');
const Joi           = require('joi');
const db            = require('../config/db');
const agenteService = require('../services/agente.service');
const chatService   = require('../services/chat.service');
const { enviarEscribiendo, enviarReaccion } = require('../adapters');
const rrRepo           = require('../repositories/respuestaRapida.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const permisosRepo     = require('../repositories/permisos.repository');
const rolTemplateRepo  = require('../repositories/rolTemplate.repository');
const { emitToConv } = require('../utils/rooms');

// ── Schemas de validación ───────────────────────────────────────────────────

const crearSchema = Joi.object({
  usuario:              Joi.string().min(2).max(60).required(),
  nombre:               Joi.string().min(2).max(100).required(),
  email:                Joi.string().email().allow('', null).optional(),
  password:             Joi.string().min(6).optional().allow('', null),
  rol:                  Joi.string().valid('admin', 'asesor', 'colaborador', 'ti').required(),
  area:                 Joi.string().min(1).max(100).required(),
  coordinador_id:       Joi.number().integer().allow(null, '').empty('').optional(),
  puede_recuperar_auto: Joi.boolean().optional(),
  permisos: Joi.object({
    empresas: Joi.array().items(Joi.string()).allow(null).optional(),
    areas:    Joi.array().items(Joi.object({
      empresa_id: Joi.string().allow('', null).optional(),
      areas:      Joi.array().items(Joi.string()).allow(null).optional(),
    })).allow(null).optional(),
    modulos:  Joi.array().items(Joi.string()).allow(null).optional(),
  }).allow(null).optional().unknown(true),
});

const editarSchema = Joi.object({
  usuario:              Joi.string().min(2).max(60).optional(),
  nombre:               Joi.string().min(2).max(100).required(),
  email:                Joi.string().email().allow('', null).optional(),
  password:             Joi.string().min(6).optional().allow(''),
  rol:                  Joi.string().valid('admin', 'asesor', 'colaborador', 'ti').required(),
  area:                 Joi.string().min(1).max(100).required(),
  coordinador_id:       Joi.number().integer().allow(null, '').empty('').optional(),
  puede_recuperar_auto: Joi.boolean().optional(),
  debe_cambiar_password: Joi.boolean().optional(),
});

const responderSchema = Joi.object({
  conversacion_id: Joi.number().integer().positive().required(),
  user_id:         Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  mensaje:         Joi.string().min(1).required(),
  agente_id:       Joi.number().integer().positive().required(),
});

const liberarSchema = Joi.object({
  conversacion_id:    Joi.number().integer().positive().required(),
  categoria_cierre_id: Joi.number().integer().positive().required()
    .messages({ 'any.required': 'Debes seleccionar una categoría de cierre' }),
  comentario_cierre:  Joi.string().min(1).max(2000).required()
    .messages({ 'string.empty': 'El comentario de cierre es obligatorio', 'any.required': 'El comentario de cierre es obligatorio' }),
  agente_nombre:      Joi.string().min(1).required(),
});

const escribiendoSchema = Joi.object({
  external_id:      Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  empresa_id:       Joi.string().required(),
  canal:            Joi.string().valid('telegram','whatsapp','facebook','instagram').default('telegram'),
  conversacion_id:  Joi.number().integer().positive().optional(),
});

const enviarMediaSchema = Joi.object({
  conversacion_id: Joi.number().integer().positive().required(),
  agente_id:       Joi.number().integer().positive().required(),
  tipo:            Joi.string().valid('photo', 'image', 'voice', 'document').required(),
  caption:         Joi.string().max(1024).optional().allow(''),
});

// ── Handlers ────────────────────────────────────────────────────────────────

/**
 * Lista todos los agentes del sistema (sin contraseñas).
 * Respuesta 200: array de agentes.
 */
const listar = async (req, res, next) => {
  try {
    const { rows } = await agenteService.listar();
    res.json(rows);
  } catch (err) { next(err); }
};

/**
 * GET /agente/directorio
 * Devuelve id, nombre, area y estado online de todos los agentes para el UI.
 */
const directorio = async (req, res, next) => {
  try {
    const { rows } = await require('../repositories/agente.repository').findAllDirectorio();
    res.json(rows);
  } catch (err) { next(err); }
};

/**
 * Crea un nuevo agente.
 * Body esperado: { nombre, email, password, rol, area }
 * Respuesta 201: { id, nombre, email }
 * Respuesta 400: errores de validación.
 */
const crear = async (req, res, next) => {
  try {
    const { error, value } = crearSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }

    const { permisos: permisosOverride, ...agenteData } = value;
    const agente = await agenteService.crear(agenteData);

    // Aplicar permisos: usa override enviado en el body, o la plantilla del rol
    let permisos = permisosOverride;
    if (!permisos) {
      const tplRes = await rolTemplateRepo.getByRol(value.rol);
      if (tplRes.rows.length) {
        const tpl = tplRes.rows[0];
        permisos = { empresas: tpl.empresas, areas: tpl.areas, modulos: tpl.modulos };
      }
    }
    if (permisos) {
      await permisosRepo.setPermisos(agente.id, permisos, req.agente.id);
    }

    const io = req.app.get('io');
    if (io) io.emit('agentes_actualizados');
    res.status(201).json(agente);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ese nombre de usuario o correo ya está en uso' });
    }
    next(err);
  }
};

/**
 * Actualiza los datos de un agente.
 * Body esperado: { usuario?, nombre, email?, rol, area, password?, coordinador_id?, puede_recuperar_auto? }
 * Respuesta 200: agente actualizado.
 * Respuesta 400: errores de validación.
 */
const actualizar = async (req, res, next) => {
  try {
    const { error, value } = editarSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }
    // Eliminar password vacío para que el servicio lo ignore
    if (!value.password) delete value.password;
    const agente = await agenteService.actualizar(req.params.id, value);
    const io = req.app.get('io');
    if (io) io.emit('agentes_actualizados');
    res.json(agente);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ese nombre de usuario o correo ya está en uso' });
    }
    next(err);
  }
};

/**
 * Genera una contraseña temporal para un subordinado (Admin o Coordinador).
 * POST /agente/:id/reset-password-temporal
 */
const resetPasswordTemporal = async (req, res, next) => {
  try {
    const targetAgenteId = Number(req.params.id);
    if (!targetAgenteId) return res.status(400).json({ error: 'ID de usuario inválido' });
    const result = await agenteService.generarPasswordTemporal(req.agente, targetAgenteId);
    const io = req.app.get('io');
    if (io) io.emit('agentes_actualizados');
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Elimina un agente por su ID.
 * Desvincula sus conversaciones antes de borrar (evita FK violation).
 * Respuesta 200: { ok: true }
 */
const eliminar = async (req, res, next) => {
  try {
    await agenteService.eliminar(req.params.id);
    const io = req.app.get('io');
    if (io) io.emit('agentes_actualizados');
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * Envía un mensaje del agente al cliente (vía Telegram) y lo registra en DB.
 * Si la conversación está en ESPERANDO_AGENTE, la pasa a "atendiendo".
 * Body esperado: { conversacion_id, mensaje, agente_id, user_id }
 * Respuesta 200: { ok: true }
 * Respuesta 400: errores de validación.
 */
const responder = async (req, res, next) => {
  try {
    const { error, value } = responderSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }
    const io = req.app.get('io');
    await chatService.responder({ ...value, agente_nombre: req.agente.nombre, io });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * Libera el chat del agente: lanza la encuesta CSAT y cierra la atención humana.
 * Body esperado: { conversacion_id, motivo, agente_nombre }
 * Respuesta 200: { ok: true }
 * Respuesta 400: errores de validación.
 * Respuesta 404: si la conversación no existe.
 */
const liberar = async (req, res, next) => {
  try {
    const { error, value } = liberarSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }
    const io = req.app.get('io');
    await chatService.liberar({ ...value, agente_id: req.agente?.id, io });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * Borrado total (GDPR): elimina en cascada todos los datos del usuario
 * (mensajes, calificaciones, conversaciones y el usuario mismo).
 * Params: id = PK de cualquier conversación del usuario.
 * Respuesta 200: { ok: true, message: "Rastro eliminado por completo" }
 * Respuesta 404: si la conversación no existe.
 */
const eliminarConversacion = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    await chatService.eliminar({ conversacion_id: req.params.id, io });
    res.json({ ok: true, message: 'Rastro eliminado por completo' });
  } catch (err) { next(err); }
};

/**
 * Envía la acción "escribiendo..." al cliente en Telegram cuando el agente está redactando.
 * Body esperado: { external_id, empresa_id }
 * Respuesta 200: { ok: true }
 */
const escribiendo = async (req, res, next) => {
  try {
    const { error, value } = escribiendoSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    await enviarEscribiendo(value.canal, value.external_id, value.empresa_id, value.conversacion_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * Recibe un archivo (imagen o audio) desde el formulario multipart,
 * lo envía al cliente vía Telegram y lo registra en DB.
 * El archivo llega en req.file.buffer (multer memoryStorage).
 */
const enviarMediaHandler = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const { error, value } = enviarMediaSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    // Validar tamaño: 16 MB voz, 8 MB fotos/documentos (límite canal más restrictivo)
    const maxBytes = value.tipo === 'voice' ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
    if (req.file.buffer.length > maxBytes) {
      return res.status(400).json({ error: 'Archivo demasiado grande' });
    }

    const io = req.app.get('io');
    await chatService.enviarMedia({
      ...value,
      buffer:        req.file.buffer,
      io,
      filename:      req.file.originalname || '',
      mimetype:      req.file.mimetype     || '',
      agente_nombre: req.agente.nombre,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ── Foto de perfil ──────────────────────────────────────────────────────────

const AVATAR_EXTS = ['.jpg', '.png', '.webp'];
const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const subirFoto = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.agente.rol !== 'admin' && req.agente.rol !== 'ti' && Number(req.agente.id) !== id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const ext        = MIME_TO_EXT[req.file.mimetype] || '.jpg';
    const avatarsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    // Obtener la foto anterior para borrarla
    const { rows } = await db.query('SELECT foto_perfil FROM agentes WHERE id = $1', [id]);
    const oldFoto = rows[0]?.foto_perfil;
    if (oldFoto) {
      const oldFilename = require('path').basename(oldFoto);
      try { fs.unlinkSync(path.join(avatarsDir, oldFilename)); } catch (_) {}
    }

    // Compatibilidad: Borrar formatos viejos si existen
    for (const e of AVATAR_EXTS) {
      try { fs.unlinkSync(path.join(avatarsDir, `${id}${e}`)); } catch (_) {}
    }

    // Nombre con timestamp para forzar actualización de caché
    const filename = `${id}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(avatarsDir, filename), req.file.buffer);

    const url = `/uploads/avatars/${filename}`;
    await db.query('UPDATE agentes SET foto_perfil = $1 WHERE id = $2', [url, id]);

    res.json({ ok: true, foto_perfil: url });
  } catch (err) { next(err); }
};

// ── Reacciones ──────────────────────────────────────────────────────────────

const reaccionarSchema = Joi.object({
  mensaje_id: Joi.number().integer().positive().required(),
  emoji:      Joi.string().max(10).allow(null, '').optional(),
});

const reaccionar = async (req, res, next) => {
  try {
    const { error, value } = reaccionarSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    const { mensaje_id, emoji } = value;
    const agente_id = req.agente.id;

    // Obtener el mensaje y su conversación
    const msgRes = await db.query(
      `SELECT m.id, m.reacciones, m.telegram_msg_id, c.id AS conv_id,
              c.empresa_id, c.departamento, c.canal, u.external_id
       FROM mensajes m
       JOIN conversaciones c ON c.id = m.conversacion_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE m.id = $1`,
      [mensaje_id]
    );
    if (!msgRes.rows.length) return res.status(404).json({ error: 'Mensaje no encontrado' });

    const msg = msgRes.rows[0];
    const reaccionesActuales = msg.reacciones || [];

    // Mantener 1 reacción por agente por mensaje
    const filtradas = reaccionesActuales.filter(r => r.agente_id !== agente_id);
    const nuevas    = emoji ? [...filtradas, { emoji, remitente: 'agente', agente_id }] : filtradas;

    await mensajeRepo.updateReacciones(mensaje_id, nuevas);

    // Notificar al canal en segundo plano (no bloquea la respuesta ni el socket)
    if (msg.telegram_msg_id) {
      enviarReaccion(msg.canal || 'telegram', msg.external_id, msg.telegram_msg_id, emoji || null, msg.empresa_id)
        .catch(() => {});
    }

    const io = req.app.get('io');
    if (io) {
      emitToConv(io, msg.departamento, 'mensaje_reaccion', {
        mensaje_id, conversacion_id: msg.conv_id, reacciones: nuevas
      });
    }

    res.json({ ok: true, reacciones: nuevas });
  } catch (err) { next(err); }
};

// ── Respuestas rápidas ──────────────────────────────────────────────────────

const RR_MEDIA_DIR = path.join(__dirname, '../../uploads/rr-media');

const rrSchema = Joi.object({
  titulo:      Joi.string().min(1).max(100).required(),
  contenido:   Joi.string().max(2000).allow('').optional(),
  removeMedia: Joi.boolean().optional(),
});

const listarRR = async (req, res, next) => {
  try {
    const { rows } = await rrRepo.findByAgente(req.agente.id);
    res.json(rows);
  } catch (err) { next(err); }
};

const crearRR = async (req, res, next) => {
  try {
    const { error, value } = rrSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    if (!req.file && !value.contenido) {
      return res.status(400).json({ error: 'Se requiere texto o un archivo media' });
    }

    let url_media = null, tipo_media = null, nombre_archivo = null;
    if (req.file) {
      const ext       = path.extname(req.file.originalname) || '.jpg';
      const filename  = `${Date.now()}${ext}`;
      const dir       = path.join(RR_MEDIA_DIR, `${req.agente.id}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), req.file.buffer);
      url_media     = `rr://${req.agente.id}/${filename}`;
      tipo_media    = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
      nombre_archivo = req.file.originalname;
    }

    const { rows } = await rrRepo.create(
      req.agente.id, value.titulo, value.contenido || null,
      url_media, tipo_media, nombre_archivo
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizarRR = async (req, res, next) => {
  try {
    const { error, value } = rrSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    // Si el agente quita el adjunto sin proveer texto, la RR quedaría vacía
    if (value.removeMedia && !req.file && !value.contenido) {
      return res.status(400).json({ error: 'Agrega texto o un nuevo archivo si quitas el adjunto' });
    }

    let url_media, tipo_media, nombre_archivo;

    if (req.file) {
      // Nuevo archivo: guardar y reemplazar
      const existing = await rrRepo.findById(req.params.id, req.agente.id);
      if (existing?.url_media?.startsWith('rr://')) {
        const oldPath = path.join(RR_MEDIA_DIR, existing.url_media.slice(5));
        fs.unlink(oldPath, () => {});
      }
      const ext      = path.extname(req.file.originalname) || '.jpg';
      const filename = `${Date.now()}${ext}`;
      const dir      = path.join(RR_MEDIA_DIR, `${req.agente.id}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), req.file.buffer);
      url_media     = `rr://${req.agente.id}/${filename}`;
      tipo_media    = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
      nombre_archivo = req.file.originalname;
    } else if (value.removeMedia) {
      // Eliminar media existente
      const existing = await rrRepo.findById(req.params.id, req.agente.id);
      if (existing?.url_media?.startsWith('rr://')) {
        fs.unlink(path.join(RR_MEDIA_DIR, existing.url_media.slice(5)), () => {});
      }
      url_media = null; tipo_media = null; nombre_archivo = null;
    }
    // else: url_media === undefined → no toca los campos de media

    const { rows } = await rrRepo.update(
      req.params.id, req.agente.id,
      value.titulo, value.contenido || null,
      url_media, tipo_media, nombre_archivo
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const eliminarRR = async (req, res, next) => {
  try {
    // Conservar la referencia de media antes de borrar (para limpieza de disco)
    const { rows } = await rrRepo.remove(req.params.id, req.agente.id);
    const urlMedia  = rows[0]?.url_media;
    // Nota: NO borramos el archivo de disco si existe — puede ser referenciado
    // por mensajes anteriores. El archivo queda huérfano pero no rompe el historial.
    res.json({ ok: true });
  } catch (err) { next(err); }
};

const usarRespuestaRapida = async (req, res, next) => {
  try {
    const { conversacion_id, rr_id } = req.body;
    if (!conversacion_id || !rr_id) {
      return res.status(400).json({ error: 'Faltan conversacion_id o rr_id' });
    }
    const io = req.app.get('io');
    await chatService.enviarRespuestaRapida({
      conversacion_id: parseInt(conversacion_id),
      rr_id:           parseInt(rr_id),
      agente_id:       req.agente.id,
      agente_nombre:   req.agente.nombre,
      io,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { 
  listar, crear, actualizar, eliminar, responder, liberar, eliminarConversacion, 
  escribiendo, enviarMediaHandler, subirFoto, reaccionar, listarRR, crearRR, 
  actualizarRR, eliminarRR, usarRespuestaRapida, directorio, resetPasswordTemporal 
};
