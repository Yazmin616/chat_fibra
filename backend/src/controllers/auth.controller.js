/**
 * @file auth.controller.js
 * @description Controlador HTTP para autenticación de agentes.
 * Recibe las peticiones de login/logout, valida el body con Joi,
 * llama al servicio correspondiente y devuelve la respuesta HTTP.
 * Los errores se propagan a errorHandler via next().
 *
 * Rutas que usa este controller:
 *   POST /auth/login   → login()
 *   POST /auth/logout  → logout()
 */

const Joi           = require('joi');
const agenteService = require('../services/agente.service');
const agenteRepo    = require('../repositories/agente.repository');
const db            = require('../config/db');

const loginSchema = Joi.object({
  usuario:    Joi.string().allow('').optional(),
  email:      Joi.string().allow('').optional(),
  identifier: Joi.string().allow('').optional(),
  password:   Joi.string().min(1).required(),
}).or('usuario', 'email', 'identifier');

/**
 * Autentica un agente por usuario o correo y devuelve un token JWT.
 * Body esperado: { usuario?: string, email?: string, identifier?: string, password: string }
 * Respuesta 200: { token: string, agente: { id, usuario, nombre, rol, area, debe_cambiar_password, ... } }
 */
const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }
    const identifier = (value.usuario || value.identifier || value.email || '').trim();
    const result = await agenteService.login(identifier, value.password);
    const io = req.app.get('io');
    if (io) io.emit('agentes_actualizados');
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Permite al usuario autenticado cambiar su contraseña obligatoria (primer inicio o tras reset).
 * Requiere verifyToken.
 */
const cambiarPasswordObligatorio = async (req, res, next) => {
  try {
    const { nueva_password } = req.body;
    if (!nueva_password || typeof nueva_password !== 'string' || nueva_password.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    const result = await agenteService.cambiarPasswordObligatorio(req.agente.id, nueva_password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Consulta la información del coordinador para la pantalla de ayuda ante contraseña olvidada.
 * Endpoint público.
 */
const consultarCoordinador = async (req, res, next) => {
  try {
    const identifier = (req.body.identifier || req.body.usuario || req.body.email || '').trim();
    if (!identifier) {
      return res.status(400).json({ error: 'Debes ingresar tu usuario' });
    }
    const data = await agenteService.obtenerCoordinadorDeAgente(identifier);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * Cierra sesión de un agente (lo marca como offline en DB).
 * El agente_id se toma del token JWT decodificado (req.agente.id).
 * Respuesta 200: { ok: true }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const logout = async (req, res, next) => {
  try {
    await agenteService.logout(req.agente.id);
    const pollingService = require('../services/pollingService');
    pollingService.setAgentOffline(req.agente.id);
    const io = req.app.get('io');
    if (io) {
      io.emit('agentes_actualizados');
      const activeList = pollingService.getActiveAgents ? pollingService.getActiveAgents() : [];
      io.emit('agente:offline', { id: Number(req.agente.id), esta_online: false });
      io.emit('agentes:active_list', activeList);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualiza last_seen del agente para confirmar que sigue activo.
 * El frontend lo llama cada 5 minutos mientras la pestaña está abierta.
 * Respuesta 200: { ok: true }
 */
const heartbeat = async (req, res, next) => {
  try {
    await agenteRepo.touchLastSeen(req.agente.id);
    const pollingService = require('../services/pollingService');
    pollingService.setAgentOnline(req.agente.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Devuelve conteos de conversaciones activas agrupadas por canal.
 * Endpoint público (no requiere token) — solo expone conteos agregados.
 */
const canalesStatus = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.canal,
        COUNT(*) FILTER (WHERE c.estado <> 'cerrada') AS activas,
        COUNT(*)                                       AS total
      FROM conversaciones c
      JOIN usuarios u ON u.id = c.usuario_id
      GROUP BY u.canal
      ORDER BY activas DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  login, logout, heartbeat, canalesStatus, 
  cambiarPasswordObligatorio, consultarCoordinador 
};
