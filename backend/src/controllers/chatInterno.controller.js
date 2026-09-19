/**
 * @file chatInterno.controller.js
 * @description Controlador HTTP para las rutas del Chat Interno Corporativo.
 */

const fs   = require('fs');
const path = require('path');
const chatInternoService = require('../services/chatInterno.service');
const logger = require('../config/logger');

async function getCanales(req, res, next) {
  try {
    const canales = await chatInternoService.listarCanales(req.agente.id);
    res.json(canales);
  } catch (err) {
    next(err);
  }
}

async function getContactos(req, res, next) {
  try {
    const contactos = await chatInternoService.listarContactos(req.agente.id);
    res.json(contactos);
  } catch (err) {
    next(err);
  }
}

async function abrirDirecto(req, res, next) {
  try {
    const { otroAgenteId } = req.body;
    if (!otroAgenteId) return res.status(400).json({ error: 'otroAgenteId es requerido' });
    const canal = await chatInternoService.obtenerOCrearDirecto(req.agente.id, otroAgenteId);
    res.json(canal);
  } catch (err) {
    next(err);
  }
}

async function crearCanal(req, res, next) {
  try {
    let fotoUrl = null;
    if (req.file) {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'chat-interno');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);
      fotoUrl = `/uploads/chat-interno/${filename}`;
    }

    let miembroIdsParsed = req.body.miembroIds;
    if (typeof miembroIdsParsed === 'string') {
      try { miembroIdsParsed = JSON.parse(miembroIdsParsed); } catch (_) { miembroIdsParsed = []; }
    }
    let adminIdsParsed = req.body.adminIds;
    if (typeof adminIdsParsed === 'string') {
      try { adminIdsParsed = JSON.parse(adminIdsParsed); } catch (_) { adminIdsParsed = []; }
    }
    let permisosParsed = req.body.permisos;
    if (typeof permisosParsed === 'string') {
      try { permisosParsed = JSON.parse(permisosParsed); } catch (_) { permisosParsed = null; }
    }

    const { nombre, descripcion, esPrivado, soloLectura, mensajesTemporales } = req.body;
    const canal = await chatInternoService.crearCanalGrupal(req.agente.id, {
      nombre,
      descripcion,
      esPrivado: esPrivado === true || esPrivado === 'true',
      soloLectura: soloLectura === true || soloLectura === 'true',
      miembroIds: Array.isArray(miembroIdsParsed) ? miembroIdsParsed : [],
      adminIds: Array.isArray(adminIdsParsed) ? adminIdsParsed : [],
      foto: fotoUrl,
      mensajesTemporales: mensajesTemporales || 'desactivados',
      permisos: permisosParsed,
    });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_interno:canal_creado', canal);
    }

    res.status(201).json(canal);
  } catch (err) {
    next(err);
  }
}

async function getMensajes(req, res, next) {
  try {
    const { canalId } = req.params;
    const cid = Number(canalId);
    if (!cid || isNaN(cid)) {
      return res.status(400).json({ error: 'ID de canal inválido' });
    }
    const { limit, beforeId } = req.query;
    const data = await chatInternoService.obtenerMensajes(
      cid,
      req.agente.id,
      limit ? Number(limit) : 50,
      beforeId ? Number(beforeId) : null
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function enviarMensaje(req, res, next) {
  try {
    const { canalId } = req.params;
    let { mensaje, tipo, url_adjunto, urlAdjunto: urlAdjuntoBody, nombre_adjunto, nombreAdjunto: nombreAdjuntoBody } = req.body;
    let urlAdjunto = url_adjunto || urlAdjuntoBody || null;
    let nombreAdjunto = nombre_adjunto || nombreAdjuntoBody || null;
    let tamanoAdjunto = null;

    if (req.file) {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'chat-interno');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      let ext = path.extname(req.file.originalname) || '';
      if (!ext && req.file.mimetype.startsWith('audio/')) {
        ext = '.webm';
      }
      const filename = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      urlAdjunto = `/uploads/chat-interno/${filename}`;
      nombreAdjunto = req.file.originalname || (tipo === 'audio' ? 'Nota de voz.webm' : filename);
      tamanoAdjunto = req.file.size;

      if (!tipo) {
        if (req.file.mimetype.startsWith('audio/')) {
          tipo = 'audio';
        } else if (req.file.mimetype.startsWith('image/')) {
          tipo = 'imagen';
        } else {
          tipo = 'archivo';
        }
      }
    }

    const resultado = await chatInternoService.enviarMensaje(
      Number(canalId),
      req.agente.id,
      req.agente.rol,
      {
        mensaje: mensaje || '',
        tipo: tipo || 'texto',
        urlAdjunto,
        nombreAdjunto,
        tamanoAdjunto,
      }
    );

    const io = req.app.get('io');
    if (io) {
      const payloadNuevo = {
        canalId: Number(canalId),
        canalNombre: resultado.canal?.nombre,
        canalTipo: resultado.canal?.tipo,
        canalFoto: resultado.canal?.foto,
        mensaje: resultado.mensaje,
      };

      // 1. Emitir a la sala del canal
      io.to(`chat_interno:canal:${canalId}`).emit('chat_interno:nuevo_mensaje', payloadNuevo);

      // 2. Emitir a la sala personal de cada miembro para entrega garantizada
      if (Array.isArray(resultado.miembros)) {
        resultado.miembros.forEach(agId => {
          io.to(`agente:${agId}`).emit('chat_interno:nuevo_mensaje', payloadNuevo);
        });
      }

      // 3. Notificación general a todos los clientes
      io.emit('chat_interno:notificacion_mensaje', {
        canalId: Number(canalId),
        canalNombre: resultado.canal?.nombre,
        canalTipo: resultado.canal?.tipo,
        canalFoto: resultado.canal?.foto,
        mensaje: resultado.mensaje,
        emisorId: req.agente.id,
        miembros: resultado.miembros,
      });
    }

    res.status(201).json(resultado.mensaje);
  } catch (err) {
    next(err);
  }
}

async function toggleReaccion(req, res, next) {
  try {
    const { mensajeId } = req.params;
    const { emoji, canalId } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji es requerido' });

    const resultado = await chatInternoService.toggleReaccion(
      Number(mensajeId),
      req.agente.id,
      emoji
    );
    const { reacciones, agregado, ultimaReaccion } = resultado;
    const cid = Number(canalId || resultado.canalId);

    const io = req.app.get('io');
    if (io && cid) {
      io.to(`chat_interno:canal:${cid}`).emit('chat_interno:reaccion_actualizada', {
        canalId: cid,
        mensajeId: Number(mensajeId),
        reacciones,
        agregado,
        ultimaReaccion,
      });

      // Emitir también globalmente para actualizar la vista previa de la barra lateral
      io.emit('chat_interno:notificacion_reaccion', {
        canalId: cid,
        mensajeId: Number(mensajeId),
        reacciones,
        agregado,
        ultimaReaccion,
        emisorId: req.agente.id,
      });
    }

    res.json({ mensajeId: Number(mensajeId), reacciones, agregado, ultimaReaccion });
  } catch (err) {
    next(err);
  }
}

async function getDetalles(req, res, next) {
  try {
    const { canalId } = req.params;
    const cid = Number(canalId);
    if (!cid || isNaN(cid)) {
      return res.status(400).json({ error: 'ID de canal inválido' });
    }
    const data = await chatInternoService.obtenerDetallesCanal(cid, req.agente.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function agregarMiembro(req, res, next) {
  try {
    const { canalId } = req.params;
    const { agenteId } = req.body;
    if (!agenteId) return res.status(400).json({ error: 'agenteId es requerido' });

    const data = await chatInternoService.agregarMiembroCanal(
      Number(canalId),
      req.agente.id,
      req.agente.rol,
      Number(agenteId)
    );

    const io = req.app.get('io');
    if (io) {
      const room = `chat_interno:canal:${canalId}`;
      if (data.mensajeSistema) {
        io.to(room).emit('chat_interno:nuevo_mensaje', {
          canalId: Number(canalId),
          mensaje: data.mensajeSistema,
        });
      }

      io.to(room).emit('chat_interno:miembros_actualizados', {
        canalId: Number(canalId),
        miembros: data.detalles.miembros,
      });

      io.emit('chat_interno:miembro_agregado', {
        canalId: Number(canalId),
        canalNombre: data.canalNombre,
        agenteId: Number(agenteId),
        agregadoPorNombre: data.agregadoPorNombre,
      });
    }

    res.json(data.detalles);
  } catch (err) {
    next(err);
  }
}

async function removerMiembro(req, res, next) {
  try {
    const { canalId, agenteId } = req.params;
    const resultado = await chatInternoService.removerMiembroCanal(
      Number(canalId),
      req.agente.id,
      req.agente.rol,
      Number(agenteId)
    );

    const io = req.app.get('io');
    if (io) {
      const room = `chat_interno:canal:${canalId}`;
      
      // 1. Forzar a todos los sockets del usuario removido a salir de la sala
      for (const [_, s] of io.sockets.sockets) {
        if (Number(s.agenteId) === Number(agenteId)) {
          s.leave(room);
        }
      }

      // 2. Emitir mensaje de sistema en la sala si hubo
      if (resultado.mensajeSistema) {
        io.to(room).emit('chat_interno:nuevo_mensaje', {
          canalId: Number(canalId),
          mensaje: resultado.mensajeSistema,
        });
      }

      // 3. Notificar a los miembros activos del canal
      io.to(room).emit('chat_interno:miembro_removido', {
        canalId: Number(canalId),
        agenteId: Number(agenteId),
        nuevoAnfitrion: resultado.nuevoAnfitrion,
      });

      // 4. Si hubo traspaso de anfitrión, notificar a todos para actualizar UI
      if (resultado.nuevoAnfitrion) {
        io.emit('chat_interno:anfitrion_cambiado', {
          canalId: Number(canalId),
          canalNombre: resultado.canalNombre,
          nuevoAnfitrion: resultado.nuevoAnfitrion,
        });
      }

      // 5. Notificar directamente al usuario afectado
      io.emit('chat_interno:fuiste_removido', resultado);
    }

    res.json({ success: true, ...resultado });
  } catch (err) {
    next(err);
  }
}

async function cambiarRolMiembro(req, res, next) {
  try {
    const { canalId, agenteId } = req.params;
    const { rol } = req.body;
    if (!rol) return res.status(400).json({ error: 'rol es requerido' });

    const data = await chatInternoService.cambiarRolMiembro(
      Number(canalId),
      req.agente.id,
      req.agente.rol,
      Number(agenteId),
      rol
    );

    const io = req.app.get('io');
    if (io) {
      const room = `chat_interno:canal:${canalId}`;

      // 1. Emitir mensaje de sistema en la conversación
      if (data.mensajeSistema) {
        io.to(room).emit('chat_interno:nuevo_mensaje', {
          canalId: Number(canalId),
          mensaje: data.mensajeSistema,
        });
      }

      // 2. Actualizar lista de miembros en tiempo real
      io.to(room).emit('chat_interno:miembros_actualizados', {
        canalId: Number(canalId),
        miembros: data.detalles.miembros,
      });

      // 3. Notificar individual y globalmente sobre el cambio de rol
      io.emit('chat_interno:rol_cambiado', {
        canalId: Number(canalId),
        canalNombre: data.canalNombre,
        agenteId: Number(agenteId),
        nuevoRol: rol,
        asignadoPorNombre: req.agente.nombre,
      });

      io.emit('chat_interno:canal_actualizado', {
        canalId: Number(canalId),
        canal: data.detalles.canal,
      });
    }

    res.json(data.detalles);
  } catch (err) {
    next(err);
  }
}

async function marcarLeido(req, res, next) {
  try {
    const { canalId } = req.params;
    const { ultimoMensajeId } = req.body;
    const resultado = await chatInternoService.marcarLeido(
      Number(canalId),
      req.agente.id,
      ultimoMensajeId ? Number(ultimoMensajeId) : null
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_interno:mensajes_leidos', {
        canalId: Number(canalId),
        agenteId: req.agente.id,
        ultimoMensajeId: resultado.ultimoMensajeId,
        tipo: resultado.tipo,
        lecturas: resultado.lecturas,
        miembros_activos: resultado.miembros_activos
      });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function eliminarCanal(req, res, next) {
  try {
    const { canalId } = req.params;
    const resultado = await chatInternoService.eliminarCanal(
      Number(canalId),
      req.agente.id,
      req.agente.rol
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_interno:canal_eliminado', {
        canalId: Number(canalId),
        nombre: resultado.nombre,
      });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function ocultarConversacion(req, res, next) {
  try {
    const { canalId } = req.params;
    const resultado = await chatInternoService.ocultarConversacion(
      Number(canalId),
      req.agente.id
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function toggleFijarCanal(req, res, next) {
  try {
    const { canalId } = req.params;
    const resultado = await chatInternoService.toggleFijarCanal(
      Number(canalId),
      req.agente.id
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function editarMensaje(req, res, next) {
  try {
    const { mensajeId } = req.params;
    const { mensaje } = req.body;
    const resultado = await chatInternoService.editarMensaje(
      Number(mensajeId),
      req.agente.id,
      mensaje
    );

    const io = req.app.get('io');
    if (io && resultado.canal_id) {
      io.to(`chat_interno:canal:${resultado.canal_id}`).emit('chat_interno:mensaje_editado', {
        canalId: Number(resultado.canal_id),
        mensajeId: Number(resultado.id),
        mensaje: resultado.mensaje,
        editado_en: resultado.editado_en,
      });
      io.emit('chat_interno:mensaje_editado_global', {
        canalId: Number(resultado.canal_id),
        mensajeId: Number(resultado.id),
        mensaje: resultado.mensaje,
        editado_en: resultado.editado_en,
      });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function toggleFijarMensaje(req, res, next) {
  try {
    const { mensajeId } = req.params;
    const { duracion } = req.body || {};
    const resultado = await chatInternoService.toggleFijarMensaje(
      Number(mensajeId),
      Number(req.agente.id),
      duracion || '7d'
    );

    const io = req.app.get('io');
    if (io && resultado.canal_id) {
      io.to(`chat_interno:canal:${resultado.canal_id}`).emit('chat_interno:mensaje_fijado', {
        canalId: Number(resultado.canal_id),
        mensajeId: Number(resultado.id),
        fijado: Boolean(resultado.fijado),
        fijado_por: resultado.fijado_por,
        fijado_en: resultado.fijado_en,
        fijado_hasta: resultado.fijado_hasta
      });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function eliminarMensaje(req, res, next) {
  try {
    const { mensajeId } = req.params;
    const resultado = await chatInternoService.eliminarMensaje(
      Number(mensajeId),
      req.agente.id,
      req.agente.rol
    );

    const io = req.app.get('io');
    if (io && resultado.canal_id) {
      io.to(`chat_interno:canal:${resultado.canal_id}`).emit('chat_interno:mensaje_eliminado', {
        canalId: Number(resultado.canal_id),
        mensajeId: Number(resultado.id),
        mensaje: resultado.mensaje,
        eliminado: true,
      });
      io.emit('chat_interno:mensaje_eliminado_global', {
        canalId: Number(resultado.canal_id),
        mensajeId: Number(resultado.id),
        mensaje: resultado.mensaje,
        eliminado: true,
      });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function actualizarCanal(req, res, next) {
  try {
    const { canalId } = req.params;
    let fotoUrl = undefined;
    if (req.file) {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'chat-interno');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);
      fotoUrl = `/uploads/chat-interno/${filename}`;
    }

    const { nombre, descripcion, mensajesTemporales, soloLectura } = req.body;
    const canal = await chatInternoService.actualizarCanal(Number(canalId), req.agente.id, {
      nombre,
      descripcion,
      foto: fotoUrl,
      mensajesTemporales,
      soloLectura: soloLectura !== undefined ? (soloLectura === true || soloLectura === 'true') : undefined,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_interno:canal_actualizado', canal);
    }

    res.json(canal);
  } catch (err) {
    next(err);
  }
}

async function toggleDestacar(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await chatInternoService.toggleDestacarMensaje(Number(id), req.agente.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function getMensajesDestacados(req, res, next) {
  try {
    const { canalId } = req.params;
    const mensajes = await chatInternoService.getMensajesDestacados(Number(canalId), req.agente.id);
    res.json(mensajes);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  toggleFijarCanal,
  ocultarConversacion,
  eliminarCanal,
  actualizarCanal,
  getCanales,
  getContactos,
  abrirDirecto,
  crearCanal,
  getMensajes,
  enviarMensaje,
  toggleReaccion,
  getDetalles,
  agregarMiembro,
  removerMiembro,
  cambiarRolMiembro,
  marcarLeido,
  editarMensaje,
  toggleFijarMensaje,
  eliminarMensaje,
  toggleDestacar,
  getMensajesDestacados,
};
