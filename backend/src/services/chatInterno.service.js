/**
 * @file chatInterno.service.js
 * @description Lógica de negocio para el Chat Interno Corporativo.
 * Control de permisos de solo lectura, reacciones con emojis y gestión de participantes con retención de historial.
 */

const chatInternoRepo = require('../repositories/chatInterno.repository');
const agenteRepo = require('../repositories/agente.repository');
const pollingService = require('./pollingService');

async function listarCanales(agenteId) {
  const canales = await chatInternoRepo.getCanalesByAgente(agenteId);
  const activeSet = new Set(pollingService.getActiveAgents ? pollingService.getActiveAgents() : []);
  return canales.map(c => {
    if (c.tipo === 'directo' && c.otro_participante) {
      return {
        ...c,
        otro_participante: {
          ...c.otro_participante,
          esta_online: Boolean(c.otro_participante.esta_online || activeSet.has(Number(c.otro_participante.id)))
        }
      };
    }
    return c;
  });
}

async function listarContactos(agenteId) {
  const contactos = await chatInternoRepo.getContactos(agenteId);
  const activeSet = new Set(pollingService.getActiveAgents ? pollingService.getActiveAgents() : []);
  return contactos.map(c => ({
    ...c,
    esta_online: Boolean(c.esta_online || activeSet.has(Number(c.id)))
  }));
}

async function obtenerOCrearDirecto(agenteIdActual, otroAgenteId) {
  if (Number(agenteIdActual) === Number(otroAgenteId)) {
    const err = new Error('No puedes iniciar un chat directo contigo mismo');
    err.status = 400;
    throw err;
  }

  let directo = await chatInternoRepo.findDirectChannel(agenteIdActual, otroAgenteId);
  if (!directo) {
    directo = await chatInternoRepo.createDirectChannel(agenteIdActual, otroAgenteId);
  }

  const canal = await chatInternoRepo.getCanalById(directo.id, agenteIdActual);
  const activeSet = new Set(pollingService.getActiveAgents ? pollingService.getActiveAgents() : []);
  if (canal && canal.tipo === 'directo' && canal.otro_participante) {
    canal.otro_participante.esta_online = Boolean(canal.otro_participante.esta_online || activeSet.has(Number(canal.otro_participante.id)));
  }
  return canal;
}

async function crearCanalGrupal(agenteIdActual, { nombre, descripcion, esPrivado, soloLectura, miembroIds }) {
  if (!nombre || !nombre.trim()) {
    const err = new Error('El nombre del canal es requerido');
    err.status = 400;
    throw err;
  }

  const canal = await chatInternoRepo.createCanal(
    nombre,
    descripcion || '',
    Boolean(esPrivado),
    Boolean(soloLectura),
    agenteIdActual,
    miembroIds || []
  );

  return await chatInternoRepo.getCanalById(canal.id, agenteIdActual);
}

async function obtenerMensajes(canalId, agenteId, limit = 50, beforeId = null) {
  const canal = await chatInternoRepo.getCanalById(canalId, agenteId);
  if (!canal) {
    const err = new Error('Canal no encontrado o sin acceso');
    err.status = 404;
    throw err;
  }

  const activeSet = new Set(pollingService.getActiveAgents ? pollingService.getActiveAgents() : []);
  if (canal.tipo === 'directo' && canal.otro_participante) {
    canal.otro_participante.esta_online = Boolean(canal.otro_participante.esta_online || activeSet.has(Number(canal.otro_participante.id)));
  }

  const mensajes = await chatInternoRepo.getMensajesByCanal(canalId, agenteId, limit, beforeId);
  return { canal, mensajes };
}

async function enviarMensaje(canalId, agenteId, agenteRol, { mensaje, tipo = 'texto', urlAdjunto = null, nombreAdjunto = null, tamanoAdjunto = null }) {
  const canal = await chatInternoRepo.getCanalById(canalId, agenteId);
  if (!canal) {
    const err = new Error('Canal no encontrado o sin acceso');
    err.status = 404;
    throw err;
  }

  // Validación: canal eliminado/cerrado
  if (canal.canal_eliminado) {
    const err = new Error('Este canal fue eliminado/cerrado. No se pueden publicar nuevos mensajes.');
    err.status = 403;
    throw err;
  }

  // Validación: miembro removido no puede publicar
  if (canal.soy_miembro_activo === false) {
    const err = new Error('Fuiste removido de este canal y ya no puedes publicar mensajes.');
    err.status = 403;
    throw err;
  }

  // Validación de permisos de Solo Lectura
  if (canal.solo_lectura) {
    const esAdmin = agenteRol === 'admin';
    const esCreador = Number(canal.creador_id) === Number(agenteId);
    if (!esAdmin && !esCreador) {
      const err = new Error('Este canal es de solo lectura. Solo los administradores o el creador pueden publicar aquí.');
      err.status = 403;
      throw err;
    }
  }

  if (!mensaje && !urlAdjunto) {
    const err = new Error('El mensaje no puede estar vacío');
    err.status = 400;
    throw err;
  }

  const nuevoMensaje = await chatInternoRepo.insertMensaje(
    canalId,
    agenteId,
    mensaje,
    tipo,
    urlAdjunto,
    nombreAdjunto,
    tamanoAdjunto
  );

  await chatInternoRepo.marcarLeido(canalId, agenteId, nuevoMensaje.id);
  const miembros = await chatInternoRepo.getMiembrosIds(canalId);

  return {
    mensaje: nuevoMensaje,
    canal,
    miembros
  };
}

async function toggleReaccion(mensajeId, agenteId, emoji) {
  const reacciones = await chatInternoRepo.toggleReaccion(mensajeId, agenteId, emoji);
  return reacciones;
}

async function obtenerDetallesCanal(canalId, agenteId) {
  const canal = await chatInternoRepo.getCanalById(canalId, agenteId);
  if (!canal) {
    const err = new Error('Canal no encontrado o sin acceso');
    err.status = 404;
    throw err;
  }

  const activeSet = new Set(pollingService.getActiveAgents ? pollingService.getActiveAgents() : []);
  const { miembros, archivos } = await chatInternoRepo.getDetallesCanal(canalId);

  const miembrosConPresencia = miembros.map(m => ({
    ...m,
    esta_online: Boolean(m.esta_online || activeSet.has(Number(m.id)))
  }));

  return {
    canal,
    miembros: miembrosConPresencia,
    archivos,
  };
}

async function agregarMiembroCanal(canalId, solicitanteId, solicitanteRol, nuevoAgenteId) {
  const canal = await chatInternoRepo.getCanalById(canalId, solicitanteId);
  if (!canal) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }

  if (canal.tipo === 'directo') {
    const err = new Error('No se pueden agregar miembros a un chat directo');
    err.status = 400;
    throw err;
  }

  const esAdmin = solicitanteRol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(solicitanteId);
  if (!esAdmin && !esCreador) {
    const err = new Error('Solo el creador o administradores pueden agregar miembros');
    err.status = 403;
    throw err;
  }

  await chatInternoRepo.agregarMiembro(canalId, nuevoAgenteId);
  return await obtenerDetallesCanal(canalId, solicitanteId);
}

async function removerMiembroCanal(canalId, solicitanteId, solicitanteRol, agenteIdRemover) {
  const canal = await chatInternoRepo.getCanalById(canalId, solicitanteId);
  if (!canal) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }

  const esAdmin = solicitanteRol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(solicitanteId);
  const esAutoRemover = Number(solicitanteId) === Number(agenteIdRemover);

  if (!esAdmin && !esCreador && !esAutoRemover) {
    const err = new Error('No tienes permisos para remover a este miembro');
    err.status = 403;
    throw err;
  }

  await chatInternoRepo.removerMiembro(canalId, agenteIdRemover, solicitanteId);

  // Obtener info del solicitante para notificar
  const { rows: [solicitante] } = await agenteRepo.findById(solicitanteId);

  return {
    canalId: Number(canalId),
    canalNombre: canal.nombre,
    agenteIdRemovido: Number(agenteIdRemover),
    removidoPorNombre: solicitante?.nombre || 'Un administrador',
  };
}

async function marcarLeido(canalId, agenteId, ultimoMensajeId) {
  await chatInternoRepo.marcarLeido(canalId, agenteId, ultimoMensajeId);
  return { success: true };
}

async function eliminarCanal(canalId, solicitanteId, solicitanteRol) {
  const canal = await chatInternoRepo.getCanalById(canalId, solicitanteId);
  if (!canal) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }

  if (canal.tipo !== 'canal') {
    const err = new Error('Solo se pueden eliminar canales grupales');
    err.status = 400;
    throw err;
  }



  const esAdmin = solicitanteRol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(solicitanteId);
  if (!esAdmin && !esCreador) {
    const err = new Error('Solo el creador del canal o un administrador pueden eliminarlo');
    err.status = 403;
    throw err;
  }

  await chatInternoRepo.archivarCanal(canalId, solicitanteId);
  return { success: true, canalId: Number(canalId), nombre: canal.nombre };
}

async function ocultarConversacion(canalId, agenteId) {
  await chatInternoRepo.ocultarCanalParaAgente(canalId, agenteId);
  return { success: true, canalId: Number(canalId) };
}

module.exports = {
  ocultarConversacion,
  eliminarCanal,
  listarCanales,
  listarContactos,
  obtenerOCrearDirecto,
  crearCanalGrupal,
  obtenerMensajes,
  enviarMensaje,
  toggleReaccion,
  obtenerDetallesCanal,
  agregarMiembroCanal,
  removerMiembroCanal,
  marcarLeido,
};
