/**
 * @file tickets.controller.js
 * @description Controlador HTTP para gestión de tickets de TI.
 */

const ticketsService = require('../services/tickets.service');

function notificarCambio(req, evento, data) {
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('ti:ticket_actualizado', { evento, data });
    }
  } catch (err) {
    console.error('[tickets.controller] Error al emitir socket:', err.message);
  }
}

async function listar(req, res, next) {
  try {
    const { estado, tipo, prioridad, asignado_id, solicitante_id, q, limit, offset } = req.query;
    const tickets = await ticketsService.listar({
      estado,
      tipo,
      prioridad,
      asignado_id,
      solicitante_id,
      q,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ticket = await ticketsService.obtenerPorId(id);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const agenteActual = req.agente;
    const {
      titulo,
      descripcion,
      tipo,
      prioridad,
      estado,
      solicitante_id,
      solicitante_nombre,
      asignado_id,
    } = req.body;

    // Si el usuario que crea es un agente regular y no especifica solicitante, él es el solicitante
    const solicitanteIdFinal = solicitante_id || (agenteActual ? agenteActual.id : null);
    const solicitanteNombreFinal = solicitante_nombre || (agenteActual ? agenteActual.nombre : null);
    // Si no se especifica asignado y el creador es de rol TI, se puede auto-asignar
    const asignadoIdFinal = asignado_id || (agenteActual && agenteActual.rol === 'ti' ? agenteActual.id : null);

    const ticket = await ticketsService.crear({
      titulo,
      descripcion,
      tipo,
      prioridad,
      estado,
      solicitante_id: solicitanteIdFinal,
      solicitante_nombre: solicitanteNombreFinal,
      asignado_id: asignadoIdFinal,
    });

    notificarCambio(req, 'creado', ticket);
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ticket = await ticketsService.actualizar(id, req.body);
    notificarCambio(req, 'actualizado', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ticketsService.eliminar(id);
    notificarCambio(req, 'eliminado', { id });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function obtenerStats(req, res, next) {
  try {
    const { solicitante_id } = req.query;
    const stats = await ticketsService.obtenerStats(solicitante_id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function agregarComentario(req, res, next) {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const agenteId = req.agente ? req.agente.id : null;
    const { comentario } = req.body;

    const result = await ticketsService.agregarComentario(ticketId, agenteId, comentario);
    notificarCambio(req, 'comentario_agregado', { ticketId, nuevoComentario: result.nuevoComentario });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  obtenerStats,
  agregarComentario,
};
