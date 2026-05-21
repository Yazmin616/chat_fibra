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

const Joi           = require('joi');
const agenteService = require('../services/agente.service');
const chatService   = require('../services/chat.service');
const { enviarEscribiendo } = require('../adapters');

// ── Schemas de validación ───────────────────────────────────────────────────

const crearSchema = Joi.object({
  nombre:   Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  rol:      Joi.string().valid('admin', 'asesor').required(),
  area:     Joi.string().min(1).max(50).required(),
});

const editarSchema = Joi.object({
  nombre:   Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).optional().allow(''),
  rol:      Joi.string().valid('admin', 'asesor').required(),
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
  external_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  empresa_id:  Joi.string().required(),
  canal:       Joi.string().valid('telegram','whatsapp','facebook','instagram').default('telegram'),
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
    await enviarEscribiendo(value.canal, value.external_id, value.empresa_id);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { listar, crear, actualizar, eliminar, responder, liberar, eliminarConversacion, escribiendo };
