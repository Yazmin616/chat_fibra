/**
 * @file conversacion.service.js
 * @description Lógica de negocio para consultas y operaciones de lectura sobre conversaciones:
 *   - listar:      lista de conversaciones visible según el rol del agente.
 *   - getMensajes: historial de mensajes filtrado por rol y área.
 *   - marcarLeido: marca mensajes como leídos y notifica al dashboard.
 *
 * El sistema tiene dos modos de visibilidad:
 *   - Admin: ve todas las conversaciones de todos los usuarios/áreas (vista consolidada).
 *   - Asesor: solo ve las conversaciones de su área de trabajo.
 */

const conversacionRepo = require('../repositories/conversacion.repository');
const mensajeRepo      = require('../repositories/mensaje.repository');
const agenteRepo       = require('../repositories/agente.repository');
const { emitToConv }   = require('../utils/rooms');

/**
 * Lista las conversaciones disponibles para el agente solicitante.
 * El resultado se ordena por fecha de última actividad (más reciente primero).
 *
 * @param {string} empresa_id - "todas" para sin filtro de empresa, o un ID concreto (ej. "fibratec").
 * @param {number} agente_id  - PK del agente que solicita el listado (determina qué puede ver).
 * @returns {Promise<object[]>} Array de conversaciones ordenadas.
 */
async function listar(empresa_id, agente_id) {
  let esAdmin    = false;
  let areaAgente = null;

  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    if (rows.length > 0) {
      esAdmin    = rows[0].rol === 'admin';
      areaAgente = rows[0].area;
    }
  }

  const { rows } = esAdmin
    ? await conversacionRepo.listAdmin(empresa_id)
    : await conversacionRepo.listByArea(areaAgente, empresa_id);

  return rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

/**
 * Obtiene el historial de mensajes de un usuario aplicando el filtro de rol:
 *   - Admin:  historial completo del usuario (todas las áreas y conversaciones).
 *   - Asesor: solo los mensajes de su área con ese usuario.
 *
 * @param {number} usuarioId      - PK del usuario cuyos mensajes se quieren ver.
 * @param {number} agente_id      - PK del agente (determina qué puede ver).
 * @param {number} [conversacion_id] - ID de la conversación activa (necesario para Asesor).
 * @returns {Promise<object[]>} Array de mensajes en orden cronológico.
 */
async function getMensajes(usuarioId, agente_id, conversacion_id) {
  // conversacion_id es siempre requerido desde la refactorización multi-empresa.
  // Garantiza aislamiento total: cada conversación pertenece a una sola empresa.
  if (!conversacion_id) {
    // Fallback defensivo: no debería ocurrir en el flujo normal
    return (await mensajeRepo.getByUsuario(usuarioId)).rows;
  }

  // Obtener los datos de la conversación para saber empresa y departamento
  const { rows: convRows } = await conversacionRepo.findById(conversacion_id);
  if (convRows.length === 0) return [];

  const { departamento, empresa_id } = convRows[0];

  // Determinar rol del agente
  let esAdmin = false;
  if (agente_id) {
    const { rows: agenteRows } = await agenteRepo.findById(agente_id);
    if (agenteRows.length > 0) esAdmin = agenteRows[0].rol === 'admin';
  }

  if (esAdmin) {
    // Admin: historial completo del usuario en la misma empresa (todas las conversaciones)
    return (await mensajeRepo.getByUsuarioAndEmpresa(usuarioId, empresa_id)).rows;
  }

  // Asesor: contexto completo de su área con ese usuario, dentro de la misma empresa.
  // Permite ver mensajes de sesiones anteriores del mismo usuario en el mismo área.
  if (departamento) {
    return (await mensajeRepo.getByUsuarioAndArea(usuarioId, departamento, empresa_id)).rows;
  }

  // Fallback: solo los mensajes de esta conversación
  return (await mensajeRepo.getByConversacion(conversacion_id)).rows;
}

/**
 * Marca todos los mensajes no leídos del usuario como leídos
 * y emite el evento `conversacion_leida` a todos los paneles conectados.
 * Afecta TODAS las conversaciones del usuario para sincronizar la vista Admin.
 *
 * @param {number} conversacion_id - PK de la conversación (se usa para obtener el usuario_id).
 * @param {import('socket.io').Server} [io] - Socket.io para notificar en tiempo real.
 * @throws {Error} 404 si la conversación no existe.
 * @returns {Promise<void>}
 */
async function marcarLeido(conversacion_id, io) {
  const { rows } = await conversacionRepo.findById(conversacion_id);
  if (rows.length === 0) {
    const err = new Error('Conversación no encontrada');
    err.status = 404;
    throw err;
  }
  const { empresa_id, usuario_id, departamento } = rows[0];

  // Marcar solo los mensajes de ESTA conversación para no afectar otras empresas
  await mensajeRepo.markReadByConversacion(conversacion_id);

  if (io) emitToConv(io, departamento, 'conversacion_leida', { conversacion_id, usuario_id, empresa_id });
}

module.exports = { listar, getMensajes, marcarLeido };
