/**
 * @file chatInterno.service.js
 * @description Lógica de negocio para el Chat Interno Corporativo.
 * Control de permisos de solo lectura, reacciones con emojis y gestión de participantes con retención de historial.
 */

const chatInternoRepo = require('../repositories/chatInterno.repository');
const agenteRepo = require('../repositories/agente.repository');
const pollingService = require('./pollingService');

/**
 * Valida si un agente está realmente conectado:
 * 1. Tiene socket activo en activeSet, O
 * 2. Su flag esta_online es true Y tuvo un heartbeat en los últimos 3 minutos.
 */
function calcularPresenciaOnline(id, dbOnline, lastSeen, activeSet) {
  if (activeSet.has(Number(id))) return true;
  if (!dbOnline || !lastSeen) return false;
  const diffMin = (Date.now() - new Date(lastSeen).getTime()) / (60 * 1000);
  return diffMin < 3;
}

async function listarCanales(agenteId) {
  const canales = await chatInternoRepo.getCanalesByAgente(agenteId);
  const activeSet = new Set(pollingService.getActiveAgents ? pollingService.getActiveAgents() : []);
  return canales.map(c => {
    if (c.tipo === 'directo' && c.otro_participante) {
      const o = c.otro_participante;
      return {
        ...c,
        otro_participante: {
          ...o,
          esta_online: calcularPresenciaOnline(o.id, o.esta_online, o.last_seen, activeSet)
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
    esta_online: calcularPresenciaOnline(c.id, c.esta_online, c.last_seen, activeSet)
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
    const o = canal.otro_participante;
    canal.otro_participante.esta_online = calcularPresenciaOnline(o.id, o.esta_online, o.last_seen, activeSet);
  }
  return canal;
}

async function crearCanalGrupal(agenteIdActual, { nombre, descripcion, esPrivado, soloLectura, miembroIds, adminIds, foto, mensajesTemporales, permisos }) {
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
    miembroIds || [],
    adminIds || [],
    foto || null,
    mensajesTemporales || 'desactivados',
    permisos || null
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
    const o = canal.otro_participante;
    canal.otro_participante.esta_online = calcularPresenciaOnline(o.id, o.esta_online, o.last_seen, activeSet);
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
  const resultado = await chatInternoRepo.toggleReaccion(mensajeId, agenteId, emoji);
  return resultado;
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
    esta_online: calcularPresenciaOnline(m.id, m.esta_online, m.last_seen, activeSet)
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

  const { miembros } = await chatInternoRepo.getDetallesCanal(canalId);
  const solicitanteMiembro = miembros.find(m => Number(m.id) === Number(solicitanteId));
  const esCanalAdmin = solicitanteMiembro?.canal_rol === 'admin';
  const esAdmin = solicitanteRol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(solicitanteId);

  if (!esAdmin && !esCreador && !esCanalAdmin) {
    const err = new Error('Solo el creador o administradores pueden agregar miembros');
    err.status = 403;
    throw err;
  }

  await chatInternoRepo.agregarMiembro(canalId, nuevoAgenteId);

  const { rows: [solicitante] } = await agenteRepo.findById(solicitanteId);
  const { rows: [target] } = await agenteRepo.findById(nuevoAgenteId);

  const mensajeTexto = `📢 ${solicitante?.nombre || 'Un administrador'} agregó a ${target?.nombre || 'un colaborador'} al grupo.`;
  const mensajeSistema = await chatInternoRepo.insertMensaje(canalId, solicitanteId, mensajeTexto, 'texto');
  const detalles = await obtenerDetallesCanal(canalId, solicitanteId);

  return {
    detalles,
    mensajeSistema,
    canalNombre: canal.nombre,
    nuevoMiembro: target ? { id: target.id, nombre: target.nombre } : null,
    agregadoPorNombre: solicitante?.nombre || 'Un administrador'
  };
}

async function removerMiembroCanal(canalId, solicitanteId, solicitanteRol, agenteIdRemover) {
  const canal = await chatInternoRepo.getCanalById(canalId, solicitanteId);
  if (!canal) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }

  const { miembros } = await chatInternoRepo.getDetallesCanal(canalId);
  const solicitanteMiembro = miembros.find(m => Number(m.id) === Number(solicitanteId));
  const esCanalAdmin = solicitanteMiembro?.canal_rol === 'admin';
  const esAdmin = solicitanteRol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(solicitanteId);
  const esAutoRemover = Number(solicitanteId) === Number(agenteIdRemover);

  if (!esAdmin && !esCreador && !esCanalAdmin && !esAutoRemover) {
    const err = new Error('No tienes permisos para remover a este miembro');
    err.status = 403;
    throw err;
  }

  // REGLA FUNDAMENTAL ESTILO WHATSAPP:
  // Ningún administrador puede sacar al Administrador Anfitrión / Creador.
  if (Number(agenteIdRemover) === Number(canal.creador_id) && !esAutoRemover) {
    const err = new Error('El administrador anfitrión no puede ser eliminado por otro administrador');
    err.status = 403;
    throw err;
  }

  const { rows: [solicitante] } = await agenteRepo.findById(solicitanteId);
  const { rows: [target] } = await agenteRepo.findById(agenteIdRemover);
  let nuevoAnfitrion = null;
  let mensajeSistema = null;

  // SUCESIÓN AUTOMÁTICA SI EL ANFITRIÓN SALE VOLUNTARIAMENTE:
  if (esAutoRemover && Number(agenteIdRemover) === Number(canal.creador_id)) {
    const siguienteHost = await chatInternoRepo.obtenerSiguienteAnfitrion(canalId, agenteIdRemover);
    if (siguienteHost) {
      await chatInternoRepo.transferirAnfitrion(canalId, siguienteHost.agente_id);
      nuevoAnfitrion = {
        id: siguienteHost.agente_id,
        nombre: siguienteHost.nombre,
      };

      // Notificar en el chat con mensaje de sistema
      mensajeSistema = await chatInternoRepo.insertMensaje(
        canalId,
        solicitanteId,
        `📢 ${solicitante?.nombre || 'El anfitrión'} salió del grupo. ${siguienteHost.nombre} es ahora el Administrador Anfitrión.`,
        'texto'
      );
    }
  } else {
    // Mensaje de sistema normal de salida o expulsión
    const msgTexto = esAutoRemover
      ? `📢 ${solicitante?.nombre || 'Un miembro'} salió del grupo.`
      : `📢 ${solicitante?.nombre || 'Un administrador'} eliminó a ${target?.nombre || 'un miembro'} del grupo.`;
    mensajeSistema = await chatInternoRepo.insertMensaje(canalId, solicitanteId, msgTexto, 'texto');
  }

  await chatInternoRepo.removerMiembro(canalId, agenteIdRemover, solicitanteId);

  return {
    canalId: Number(canalId),
    canalNombre: canal.nombre,
    agenteIdRemovido: Number(agenteIdRemover),
    removidoPorNombre: solicitante?.nombre || 'Un administrador',
    esSalidaVoluntaria: esAutoRemover,
    nuevoAnfitrion,
    mensajeSistema,
  };
}

async function cambiarRolMiembro(canalId, solicitanteId, solicitanteRol, targetAgenteId, nuevoRol) {
  const canal = await chatInternoRepo.getCanalById(canalId, solicitanteId);
  if (!canal) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }

  if (canal.tipo !== 'canal') {
    const err = new Error('Solo se pueden gestionar roles en canales grupales');
    err.status = 400;
    throw err;
  }

  if (!['admin', 'miembro'].includes(nuevoRol)) {
    const err = new Error('Rol inválido. Debe ser "admin" o "miembro"');
    err.status = 400;
    throw err;
  }

  const { miembros } = await chatInternoRepo.getDetallesCanal(canalId);
  const solicitanteMiembro = miembros.find(m => Number(m.id) === Number(solicitanteId));
  const esCanalAdmin = solicitanteMiembro?.canal_rol === 'admin';
  const esAdmin = solicitanteRol === 'admin';
  const esCreador = Number(canal.creador_id) === Number(solicitanteId);

  if (!esAdmin && !esCreador && !esCanalAdmin) {
    const err = new Error('Solo el anfitrión o administradores pueden cambiar roles de miembros');
    err.status = 403;
    throw err;
  }

  if (Number(targetAgenteId) === Number(canal.creador_id) && nuevoRol !== 'admin') {
    const err = new Error('No se puede revocar el rol de administrador al Anfitrión del grupo');
    err.status = 403;
    throw err;
  }

  await chatInternoRepo.cambiarRolMiembro(canalId, targetAgenteId, nuevoRol);

  const { rows: [target] } = await agenteRepo.findById(targetAgenteId);
  const mensajeTexto = nuevoRol === 'admin'
    ? `📢 ${target?.nombre || 'Un miembro'} ahora es Administrador del grupo.`
    : `📢 ${target?.nombre || 'Un miembro'} ya no es Administrador del grupo.`;

  const mensajeSistema = await chatInternoRepo.insertMensaje(canalId, solicitanteId, mensajeTexto, 'texto');
  const detalles = await obtenerDetallesCanal(canalId, solicitanteId);

  return {
    detalles,
    mensajeSistema,
    canalNombre: canal.nombre,
    nuevoRol,
    targetAgente: target ? { id: target.id, nombre: target.nombre } : null
  };
}

async function marcarLeido(canalId, agenteId, ultimoMensajeId) {
  return await chatInternoRepo.marcarLeido(canalId, agenteId, ultimoMensajeId);
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

async function toggleFijarCanal(canalId, agenteId) {
  const fijado = await chatInternoRepo.toggleFijarCanal(canalId, agenteId);
  return { success: true, canalId: Number(canalId), fijado };
}

async function editarMensaje(mensajeId, agenteId, nuevoTexto) {
  if (!nuevoTexto || !nuevoTexto.trim()) {
    const err = new Error('El texto del mensaje no puede estar vacío.');
    err.status = 400;
    throw err;
  }
  const actualizado = await chatInternoRepo.editarMensaje(mensajeId, agenteId, nuevoTexto.trim());
  if (!actualizado) {
    const err = new Error('No se pudo editar el mensaje o no tienes permisos.');
    err.status = 403;
    throw err;
  }
  return actualizado;
}

async function toggleFijarMensaje(mensajeId, agenteId, duracion = '7d') {
  const actualizado = await chatInternoRepo.toggleFijarMensaje(mensajeId, agenteId, duracion);
  if (!actualizado) {
    const err = new Error('No se encontró el mensaje a fijar.');
    err.status = 404;
    throw err;
  }
  return actualizado;
}

async function eliminarMensaje(mensajeId, agenteId, agenteRol) {
  const esAdmin = agenteRol === 'admin';
  const eliminado = await chatInternoRepo.eliminarMensaje(mensajeId, agenteId, esAdmin);
  if (!eliminado) {
    const err = new Error('No se pudo eliminar el mensaje o no tienes permisos.');
    err.status = 403;
    throw err;
  }
  return eliminado;
}

async function actualizarCanal(canalId, agenteId, datos) {
  const canal = await chatInternoRepo.getCanalById(canalId, agenteId);
  if (!canal) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }
  await chatInternoRepo.actualizarCanal(canalId, datos);
  return await chatInternoRepo.getCanalById(canalId, agenteId);
}

async function toggleDestacarMensaje(mensajeId, agenteId) {
  return await chatInternoRepo.toggleDestacarMensaje(mensajeId, agenteId);
}

async function getMensajesDestacados(canalId, agenteId) {
  return await chatInternoRepo.getMensajesDestacadosByCanal(canalId, agenteId);
}

module.exports = {
  toggleFijarCanal,
  ocultarConversacion,
  eliminarCanal,
  actualizarCanal,
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
  cambiarRolMiembro,
  marcarLeido,
  editarMensaje,
  toggleFijarMensaje,
  eliminarMensaje,
  toggleDestacarMensaje,
  getMensajesDestacados,
};
