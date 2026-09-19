/**
 * @file tickets.service.js
 * @description Servicio de lógica de negocio para Tickets de TI.
 */

const ticketsRepo = require('../repositories/tickets.repository');

const TIPOS_VALIDOS = ['error', 'correccion', 'mejora', 'soporte', 'tarea'];
const PRIORIDADES_VALIDAS = ['baja', 'media', 'alta', 'urgente'];
const ESTADOS_VALIDOS = ['abierto', 'en_progreso', 'revision', 'resuelto', 'cancelado'];

async function listar(filtros) {
  return ticketsRepo.findAll(filtros);
}

async function obtenerPorId(id) {
  const ticket = await ticketsRepo.findById(id);
  if (!ticket) {
    const err = new Error('Ticket no encontrado');
    err.status = 404;
    throw err;
  }
  const comentarios = await ticketsRepo.getComentarios(id);
  return { ...ticket, comentarios };
}

async function crear(datos) {
  if (!datos.titulo || !datos.titulo.trim()) {
    const err = new Error('El título del ticket es obligatorio');
    err.status = 400;
    throw err;
  }
  if (!datos.descripcion || !datos.descripcion.trim()) {
    const err = new Error('La descripción del ticket es obligatoria');
    err.status = 400;
    throw err;
  }

  const tipo = TIPOS_VALIDOS.includes(datos.tipo) ? datos.tipo : 'error';
  const prioridad = PRIORIDADES_VALIDAS.includes(datos.prioridad) ? datos.prioridad : 'media';
  const estado = ESTADOS_VALIDOS.includes(datos.estado) ? datos.estado : 'abierto';

  return ticketsRepo.create({
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    tipo,
    prioridad,
    estado,
    solicitante_id: datos.solicitante_id,
    solicitante_nombre: datos.solicitante_nombre,
    asignado_id: datos.asignado_id,
  });
}

async function actualizar(id, datos) {
  const ticketExistente = await ticketsRepo.findById(id);
  if (!ticketExistente) {
    const err = new Error('Ticket no encontrado');
    err.status = 404;
    throw err;
  }

  const campos = {};
  if (datos.titulo !== undefined) campos.titulo = datos.titulo;
  if (datos.descripcion !== undefined) campos.descripcion = datos.descripcion;
  if (datos.tipo && TIPOS_VALIDOS.includes(datos.tipo)) campos.tipo = datos.tipo;
  if (datos.prioridad && PRIORIDADES_VALIDAS.includes(datos.prioridad)) campos.prioridad = datos.prioridad;
  if (datos.estado && ESTADOS_VALIDOS.includes(datos.estado)) campos.estado = datos.estado;
  if (datos.asignado_id !== undefined) campos.asignado_id = datos.asignado_id;
  if (datos.solicitante_nombre !== undefined) campos.solicitante_nombre = datos.solicitante_nombre;
  if (datos.notas_resolucion !== undefined) campos.notas_resolucion = datos.notas_resolucion;

  const actualizado = await ticketsRepo.update(id, campos);
  return actualizado;
}

async function eliminar(id) {
  const eliminado = await ticketsRepo.remove(id);
  if (!eliminado) {
    const err = new Error('Ticket no encontrado para eliminar');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

async function obtenerStats(solicitante_id = null) {
  return ticketsRepo.getStats(solicitante_id);
}

async function agregarComentario(ticketId, agenteId, comentario) {
  if (!comentario || !comentario.trim()) {
    const err = new Error('El comentario no puede estar vacío');
    err.status = 400;
    throw err;
  }
  const ticket = await ticketsRepo.findById(ticketId);
  if (!ticket) {
    const err = new Error('Ticket no encontrado');
    err.status = 404;
    throw err;
  }
  const nuevoComentario = await ticketsRepo.addComentario(ticketId, agenteId, comentario);
  const comentarios = await ticketsRepo.getComentarios(ticketId);
  return { nuevoComentario, comentarios };
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
