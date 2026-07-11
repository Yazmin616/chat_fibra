/**
 * @file conversacion.controller.js
 * @description Controlador HTTP para listado y lectura de conversaciones.
 *
 * Rutas asociadas (ver conversaciones.routes.js):
 *   GET  /conversaciones/                   → listar()
 *   POST /conversaciones/marcar-leido/:id   → marcarLeido()
 *   GET  /conversaciones/por-usuario/:id    → getMensajesPorUsuario()
 *   GET  /conversaciones/:id                → getMensajes()
 */

const conversacionService = require('../services/conversacion.service');
const mensajeRepo         = require('../repositories/mensaje.repository');

/**
 * Lista las conversaciones visibles para el agente solicitante.
 * Query params: empresa_id {string}, agente_id {number}
 * Respuesta 200: array de conversaciones con metadatos (último mensaje, no_leidos, etc.).
 */
const listar = async (req, res, next) => {
  try {
    const { empresa_id, agente_id } = req.query;
    const result = await conversacionService.listar(empresa_id, agente_id);
    res.json(result);
  } catch (err) { next(err); }
};

/**
 * Marca como leídos todos los mensajes del usuario de una conversación.
 * Emite `conversacion_leida` por Socket.io.
 * Params: id = PK de la conversación.
 * Respuesta 200: { ok: true }
 * Respuesta 404: si la conversación no existe.
 */
const marcarLeido = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    await conversacionService.marcarLeido(req.params.id, req.agente, io);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * Devuelve el historial de mensajes de un usuario aplicando el filtro de rol.
 * Params:  usuarioId = PK del usuario.
 * Query:   agente_id {number}, conversacion_id {number} (requerido para Asesor).
 * Respuesta 200: array de mensajes en orden cronológico.
 */
const getMensajesPorUsuario = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const { agente_id, conversacion_id } = req.query;
    const msgs = await conversacionService.getMensajes(usuarioId, agente_id, conversacion_id);
    res.json(msgs);
  } catch (err) { next(err); }
};

/**
 * Devuelve todos los mensajes de una conversación específica por su ID.
 * Params: id = PK de la conversación.
 * Respuesta 200: array de mensajes en orden cronológico.
 */
const getMensajes = async (req, res, next) => {
  try {
    const { rows } = await mensajeRepo.getByConversacion(req.params.id);
    res.json(rows);
  } catch (err) { next(err); }
};

module.exports = { listar, getMensajesPorUsuario, marcarLeido, getMensajes };
