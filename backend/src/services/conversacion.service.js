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
  let areasAgente = [];

  if (agente_id) {
    const { rows } = await agenteRepo.findById(agente_id);
    if (rows.length > 0) {
      esAdmin    = rows[0].rol === 'admin';
      
      const permisosRepo = require('../repositories/permisos.repository');
      const permisos = await permisosRepo.getPermisos(agente_id);
      
      if (permisos && permisos.areas && permisos.areas.length > 0) {
        // Encontrar los permisos de área para la empresa solicitada o __todas__
        const areaConfig = permisos.areas.find(a => a.empresa_id === empresa_id || a.empresa_id === '__todas__');
        if (areaConfig && areaConfig.areas) {
          areasAgente = areaConfig.areas;
        }
      } else {
        // Fallback al rol legacy por si no hay permisos JSON
        areasAgente = [rows[0].area];
      }
    }
  }

  // Si el asesor tiene '__todas__' en sus áreas, puede ver todo como el admin
  if (areasAgente.includes('__todas__')) {
    esAdmin = true;
  }

  const { rows } = esAdmin
    ? await conversacionRepo.listAdmin(empresa_id)
    : await conversacionRepo.listByAreas(areasAgente.length > 0 ? areasAgente : ['ninguna'], empresa_id);

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
async function marcarLeido(conversacion_id, agente, io) {
  const { rows } = await conversacionRepo.findById(conversacion_id);
  if (rows.length === 0) {
    const err = new Error('Conversación no encontrada');
    err.status = 404;
    throw err;
  }
  const conv = rows[0];
  const { empresa_id, usuario_id, departamento } = conv;

  // Marcar solo los mensajes de ESTA conversación para no afectar otras empresas
  await mensajeRepo.markReadByConversacion(conversacion_id);

  // Auto-asignación si el chat está abierto pero nadie lo tiene asignado aún
  if (!conv.agente_id && agente && (conv.estado === 'abierta' || conv.estado === 'ESPERANDO_AGENTE' || conv.estado === 'atendiendo')) {
    await conversacionRepo.assignAgente(conversacion_id, agente.id);
    
    try {
      const { marcarTomada } = require('./transferencia.service');
      await marcarTomada(conversacion_id, agente.id, agente.nombre);
    } catch (_) {}

    const nuevoEstado = conv.estado === 'ESPERANDO_AGENTE' ? 'atendiendo' : conv.estado;

    if (io) {
      emitToConv(io, departamento, 'conversacion_actualizada', {
        id: conversacion_id,
        agente_id: agente.id,
        agente_nombre: agente.nombre,
        estado: nuevoEstado
      });
    }
  }

  if (io) emitToConv(io, departamento, 'conversacion_leida', { conversacion_id, usuario_id, empresa_id });
}

module.exports = { listar, getMensajes, marcarLeido };
