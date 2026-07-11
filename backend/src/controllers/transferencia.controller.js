/**
 * @file transferencia.controller.js
 * @description Endpoints HTTP para transferencia de chats y consulta del log de auditoría.
 */

const transferenciaService = require('../services/transferencia.service');
const transferenciaRepo    = require('../repositories/transferencia.repository');
const logger               = require('../config/logger');

/**
 * POST /transferencias/transferir
 * Body: { conversacion_id, area_destino, nota, agente_destino_id, agente_destino_nombre }
 * Token: agente autenticado (agente_id, nombre y area extraídos del JWT)
 */
async function transferirChat(req, res, next) {
  try {
    const { conversacion_id, area_destino, nota, agente_destino_id, agente_destino_nombre } = req.body;
    const { id: agente_id, nombre: agente_nombre, area: area_origen } = req.agente;

    if (!conversacion_id || !area_destino || !nota?.trim()) {
      return res.status(400).json({ error: 'Faltan datos: conversacion_id, area_destino, nota' });
    }

    const io = req.app.get('io');
    const result = await transferenciaService.transferir({
      conversacion_id: Number(conversacion_id),
      agente_id,
      agente_nombre,
      area_origen,
      area_destino,
      agente_destino_id,
      agente_destino_nombre,
      nota: nota.trim(),
      io,
    });

    logger.info(`[TRANSFER] Conv ${conversacion_id}: ${area_origen} → ${area_destino} (${result.tipo}) por agente ${agente_id}`);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /transferencias/conversacion/:id
 * Historial de transferencias de una conversación específica.
 * Accesible para cualquier agente autenticado.
 */
async function getByConversacion(req, res, next) {
  try {
    const { rows } = await transferenciaRepo.listByConversacion(Number(req.params.id));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /transferencias
 * Lista todas las transferencias (solo admin/supervisor).
 * Query: ?empresa_id=fibratec  (o "todas")
 */
async function getAll(req, res, next) {
  try {
    const empresa_id = req.query.empresa_id || 'todas';
    const { rows } = await transferenciaRepo.listAll(empresa_id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { transferirChat, getByConversacion, getAll };
