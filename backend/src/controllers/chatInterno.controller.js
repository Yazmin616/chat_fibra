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
    const { nombre, descripcion, esPrivado, soloLectura, miembroIds } = req.body;
    const canal = await chatInternoService.crearCanalGrupal(req.agente.id, {
      nombre,
      descripcion,
      esPrivado,
      soloLectura,
      miembroIds,
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
    let { mensaje, tipo } = req.body;
    let urlAdjunto = null;
    let nombreAdjunto = null;
    let tamanoAdjunto = null;

    if (req.file) {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'chat-interno');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const ext = path.extname(req.file.originalname) || '';
      const filename = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      urlAdjunto = `/uploads/chat-interno/${filename}`;
      nombreAdjunto = req.file.originalname;
      tamanoAdjunto = req.file.size;

      if (!tipo) {
        tipo = req.file.mimetype.startsWith('image/') ? 'imagen' : 'archivo';
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
      io.to(`chat_interno:canal:${canalId}`).emit('chat_interno:nuevo_mensaje', {
        canalId: Number(canalId),
        mensaje: resultado.mensaje,
      });

      io.emit('chat_interno:notificacion_mensaje', {
        canalId: Number(canalId),
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

    const reacciones = await chatInternoService.toggleReaccion(
      Number(mensajeId),
      req.agente.id,
      emoji
    );

    const io = req.app.get('io');
    if (io && canalId) {
      io.to(`chat_interno:canal:${canalId}`).emit('chat_interno:reaccion_actualizada', {
        canalId: Number(canalId),
        mensajeId: Number(mensajeId),
        reacciones,
      });
    }

    res.json({ mensajeId: Number(mensajeId), reacciones });
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
      io.to(`chat_interno:canal:${canalId}`).emit('chat_interno:miembros_actualizados', {
        canalId: Number(canalId),
        miembros: data.miembros,
      });
    }

    res.json(data);
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

      // 2. Notificar a los miembros activos del canal
      io.to(room).emit('chat_interno:miembro_removido', {
        canalId: Number(canalId),
        agenteId: Number(agenteId),
      });

      // 3. Notificar directamente al usuario afectado
      io.emit('chat_interno:fuiste_removido', resultado);
    }

    res.json({ success: true, ...resultado });
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
      Number(ultimoMensajeId)
    );
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

module.exports = {
  ocultarConversacion,
  eliminarCanal,
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
  marcarLeido,
};
