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
 */

const path          = require('path');
const fs            = require('fs');
const Joi           = require('joi');
const db            = require('../config/db');
const agenteService = require('../services/agente.service');
const chatService   = require('../services/chat.service');
const { enviarEscribiendo, enviarReaccion } = require('../adapters');
const rrRepo        = require('../repositories/respuestaRapida.repository');
const mensajeRepo   = require('../repositories/mensaje.repository');
const { emitToConv } = require('../utils/rooms');

// ── Schemas de validación ───────────────────────────────────────────────────

const crearSchema = Joi.object({
  nombre:   Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  rol:      Joi.string().valid('admin', 'asesor', 'ti').required(),
  area:     Joi.string().min(1).max(50).required(),
});

const editarSchema = Joi.object({
  nombre:   Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).optional().allow(''),
  rol:      Joi.string().valid('admin', 'asesor', 'ti').required(),
  area:     Joi.string().min(1).max(50).required(),
});

const responderSchema = Joi.object({
  conversacion_id: Joi.number().integer().positive().required(),
  user_id:         Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  mensaje:         Joi.string().min(1).required(),
  agente_id:       Joi.number().integer().positive().required(),
});

const liberarSchema = Joi.object({
  conversacion_id: Joi.number().integer().positive().required(),
  motivo:          Joi.string().min(1).required(),
  agente_nombre:   Joi.string().min(1).required(),
  solucion:        Joi.string().min(1).max(1000).optional().allow(''),
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
  tipo:            Joi.string().valid('photo', 'voice').required(),
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
    const agente = await agenteService.crear(value);
    const io = req.app.get('io');
    if (io) io.emit('agentes_actualizados');
    res.status(201).json(agente);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ese correo ya está registrado' });
    }
    next(err);
  }
};

/**
 * Actualiza los datos de un agente.
 * Body esperado: { nombre, email, rol, area, password? }
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
      return res.status(400).json({ error: 'Ese correo ya está registrado por otro agente' });
    }
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
    await chatService.responder({ ...value, io });
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
    await chatService.liberar({ ...value, io });
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

    // Validar tamaño: 10 MB fotos, 16 MB voz
    const maxBytes = value.tipo === 'voice' ? 16 * 1024 * 1024 : 10 * 1024 * 1024;
    if (req.file.buffer.length > maxBytes) {
      return res.status(400).json({ error: 'Archivo demasiado grande' });
    }

    const io = req.app.get('io');
    await chatService.enviarMedia({ ...value, buffer: req.file.buffer, io });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ── Foto de perfil ──────────────────────────────────────────────────────────

const AVATAR_EXTS = ['.jpg', '.png', '.webp'];
const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const subirFoto = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.agente.rol !== 'admin' && req.agente.id !== id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const ext        = MIME_TO_EXT[req.file.mimetype] || '.jpg';
    const avatarsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');

    // Borrar todas las versiones anteriores del avatar (cualquier extensión)
    for (const e of AVATAR_EXTS) {
      try { fs.unlinkSync(path.join(avatarsDir, `${id}${e}`)); } catch (_) {}
    }

    const filename = `${id}${ext}`;
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

const rrSchema = Joi.object({
  titulo:    Joi.string().min(1).max(100).required(),
  contenido: Joi.string().min(1).max(2000).required(),
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
    const { rows } = await rrRepo.create(req.agente.id, value.titulo, value.contenido);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizarRR = async (req, res, next) => {
  try {
    const { error, value } = rrSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    const { rows } = await rrRepo.update(req.params.id, req.agente.id, value.titulo, value.contenido);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const eliminarRR = async (req, res, next) => {
  try {
    await rrRepo.remove(req.params.id, req.agente.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { listar, crear, actualizar, eliminar, responder, liberar, eliminarConversacion, escribiendo, enviarMediaHandler, subirFoto, reaccionar, listarRR, crearRR, actualizarRR, eliminarRR };
