/**
 * @file useChatInterno.js
 * @description Hook personalizado para gestionar el estado, presencia instantánea,
 * reacciones con emojis, control estricto de membresía y WebSockets del Chat Interno Corporativo.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotifications } from './useNotifications';
import { chatInternoService } from '../services/chatInterno.service';
import { notificarMensajeCanal, reproducirSonidoWhatsAppInChat } from '../utils/audioNotificationPlayer';

export function useChatInterno({ socket, user, canalInicialId }) {
  const { notify } = useNotifications();
  const [canales, setCanales] = useState([]);
  const canalesRef = useRef(canales);
  useEffect(() => { canalesRef.current = canales; }, [canales]);
  const [contactos, setContactos] = useState([]);
  const contactosRef = useRef(contactos);
  useEffect(() => { contactosRef.current = contactos; }, [contactos]);
  const [canalActivo, setCanalActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [escribiendoMap, setEscribiendoMap] = useState({});

  const canalActivoRef = useRef(canalActivo);
  const lastSoundMsgIdRef = useRef(null);
  useEffect(() => {
    canalActivoRef.current = canalActivo;
    if (socket && canalActivo?.id && canalActivo?.soy_miembro_activo !== false) {
      socket.emit('chat_interno:join_canal', { canalId: canalActivo.id, agenteId: user?.id });
    }
  }, [canalActivo, socket, user?.id]);

  const typingTimeoutRef = useRef(null);
  const typingTimersRef = useRef({});

  // 1. Cargar canales y contactos iniciales
  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [listCanales, listContactos] = await Promise.all([
        chatInternoService.getCanales(),
        chatInternoService.getContactos(),
      ]);
      setCanales(listCanales);
      setContactos(listContactos);


    } catch (err) {
      console.error('Error al cargar datos del chat interno:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  // 2. Seleccionar canal y cargar sus mensajes (soporta objeto canal o canalId numérico)
  const seleccionarCanal = useCallback(async (canalOId) => {
    if (!canalOId) return;

    let canal = canalOId;
    if (typeof canalOId === 'number' || typeof canalOId === 'string') {
      const cid = Number(canalOId);
      if (isNaN(cid)) return;
      canal = canalesRef.current?.find(c => Number(c.id) === cid);
      if (!canal) {
        try {
          const list = await chatInternoService.getCanales();
          setCanales(list);
          canalesRef.current = list;
          canal = list.find(c => Number(c.id) === cid);
        } catch (err) {
          console.error('Error al buscar canal:', err);
        }
      }
    }

    if (!canal || !canal.id) return;

    if (socket && canalActivoRef.current && canalActivoRef.current.id !== canal.id) {
      socket.emit('chat_interno:leave_canal', { canalId: canalActivoRef.current.id });
    }

    setCanalActivo(canal);
    setCargandoMensajes(true);

    // Solo unirse a la sala en tiempo real si es miembro activo
    if (socket && canal.soy_miembro_activo !== false) {
      socket.emit('chat_interno:join_canal', { canalId: canal.id, agenteId: user?.id });
    }

    try {
      const data = await chatInternoService.getMensajes(canal.id);
      setMensajes(data.mensajes || []);

      const lastMsg = (data.mensajes && data.mensajes.length > 0)
        ? data.mensajes[data.mensajes.length - 1]
        : null;

      // Siempre marcar como leído en BD, incluso para miembros inactivos/archivados
      await chatInternoService.marcarLeido(canal.id, lastMsg ? lastMsg.id : null);

      setCanales(prev =>
        prev.map(c => Number(c.id) === Number(canal.id) ? { ...c, unread_count: 0 } : c)
      );
    } catch (err) {
      console.error('Error al cargar mensajes del canal:', err);
    } finally {
      setCargandoMensajes(false);
    }
  }, [socket, user]);

  // 3. Abrir o crear chat directo con un contacto
  const abrirChatDirecto = useCallback(async (contactoId) => {
    try {
      const canal = await chatInternoService.abrirChatDirecto(contactoId);
      
      setCanales(prev => {
        const exists = prev.find(c => Number(c.id) === Number(canal.id));
        if (!exists) return [...prev, canal];
        return prev;
      });

      seleccionarCanal(canal);
    } catch (err) {
      console.error('Error al abrir chat directo:', err);
    }
  }, [seleccionarCanal]);

  // Escuchar evento global para seleccionar canal o abrir chat directo
  useEffect(() => {
    const handleSeleccionarCustom = (e) => {
      if (e.detail?.canalId) {
        seleccionarCanal(e.detail.canalId);
      }
    };
    const handleAbrirDirectoCustom = (e) => {
      if (e.detail?.contactoId) {
        abrirChatDirecto(e.detail.contactoId);
      }
    };
    window.addEventListener('chat_interno:seleccionar_canal', handleSeleccionarCustom);
    window.addEventListener('chat_interno:abrir_directo', handleAbrirDirectoCustom);
    return () => {
      window.removeEventListener('chat_interno:seleccionar_canal', handleSeleccionarCustom);
      window.removeEventListener('chat_interno:abrir_directo', handleAbrirDirectoCustom);
    };
  }, [seleccionarCanal, abrirChatDirecto]);

  useEffect(() => {
    if (user) {
      cargarDatos();
    }
  }, [user, cargarDatos]);

  // 4. Crear canal grupal
  const crearCanal = useCallback(async (datos) => {
    try {
      const nuevoCanal = await chatInternoService.crearCanal(datos);

      setCanales(prev => {
        if (prev.some(c => Number(c.id) === Number(nuevoCanal.id))) return prev;
        return [nuevoCanal, ...prev];
      });
      seleccionarCanal(nuevoCanal);
      return nuevoCanal;
    } catch (err) {
      console.error('Error al crear canal:', err);
      throw err;
    }
  }, [seleccionarCanal]);

    // Eliminar / Cerrar canal grupal para todo el equipo (Creador / Admin)
  const eliminarCanal = useCallback(async (canalId) => {
    try {
      await chatInternoService.eliminarCanal(canalId);
      setCanales(prev =>
        prev.map(c => c.id === canalId ? { ...c, canal_eliminado: true, soy_miembro_activo: false } : c)
      );
      setCanalActivo(prev => {
        if (prev && prev.id === canalId) {
          return { ...prev, canal_eliminado: true, soy_miembro_activo: false };
        }
        return prev;
      });
    } catch (err) {
      console.error('Error al eliminar canal:', err);
      throw err;
    }
  }, []);

  // Ocultar / Eliminar conversación únicamente de mi vista
  const ocultarConversacion = useCallback(async (canalId) => {
    try {
      await chatInternoService.ocultarConversacion(canalId);
      setCanales(prev => prev.filter(c => c.id !== canalId));
      if (canalActivoRef.current && canalActivoRef.current.id === canalId) {
        setCanalActivo(null);
        setMensajes([]);
      }
    } catch (err) {
      console.error('Error al ocultar conversación:', err);
      throw err;
    }
  }, []);

  // Fijar / Desfijar canal o chat (WhatsApp Style)
  const toggleFijarCanal = useCallback(async (canalId) => {
    try {
      const res = await chatInternoService.toggleFijarCanal(canalId);
      setCanales(prev => {
        const updated = prev.map(c => c.id === canalId ? { ...c, fijado: res.fijado, fijado_en: res.fijado ? new Date().toISOString() : null } : c);
        return [...updated].sort((a, b) => {
          if (a.fijado && !b.fijado) return -1;
          if (!a.fijado && b.fijado) return 1;
          if (a.fijado && b.fijado) {
            return new Date(b.fijado_en || 0) - new Date(a.fijado_en || 0);
          }
          const timeA = new Date(a.ultimo_mensaje?.created_at || a.created_at).getTime();
          const timeB = new Date(b.ultimo_mensaje?.created_at || b.created_at).getTime();
          return timeB - timeA;
        });
      });
      setCanalActivo(prev => {
        if (prev && prev.id === canalId) {
          return { ...prev, fijado: res.fijado };
        }
        return prev;
      });
      notify('Chat Fijado', res.fijado ? 'Chat fijado en la parte superior.' : 'Chat desfijado.');
    } catch (err) {
      console.error('Error al fijar/desfijar canal:', err);
    }
  }, [notify]);

  // 5. Enviar mensaje de texto
  const enviarTexto = useCallback(async (texto) => {
    const canal = canalActivoRef.current;
    if (!canal || !texto.trim()) return;

    if (socket) {
      socket.emit('chat_interno:stop_typing', {
        canalId: canal.id,
        agenteId: user?.id
      });
    }

    try {
      const isDestOnline = canal.tipo === 'directo' ? Boolean(canal.otro_participante?.esta_online) : false;
      const nuevoMensaje = await chatInternoService.enviarMensajeTexto(canal.id, texto.trim());
      const msgConEstado = {
        ...nuevoMensaje,
        leido: false,
        entregado: Boolean(nuevoMensaje.entregado || isDestOnline)
      };

      setMensajes(prev => {
        const exists = prev.some(m => Number(m.id) === Number(msgConEstado.id));
        return exists ? prev : [...prev, msgConEstado];
      });

      setCanales(prev => {
        const target = prev.find(c => Number(c.id) === Number(canal.id));
        if (target) {
          const updated = { ...target, ultimo_mensaje: msgConEstado };
          const others = prev.filter(c => Number(c.id) !== Number(canal.id));
          return [updated, ...others];
        } else {
          return [{ ...canal, ultimo_mensaje: msgConEstado }, ...prev];
        }
      });
    } catch (err) {
      console.error('Error al enviar mensaje de texto interno:', err);
      throw err;
    }
  }, [socket, user]);

  // 6. Enviar archivo adjunto (incluye tipo: 'audio', 'imagen', 'archivo')
  const enviarAdjunto = useCallback(async (file, textoOpcional = '', tipo = null) => {
    const canal = canalActivoRef.current;
    if (!canal || !file) return;

    try {
      const isDestOnline = canal.tipo === 'directo' ? Boolean(canal.otro_participante?.esta_online) : false;
      const nuevoMensaje = await chatInternoService.enviarMensajeAdjunto(canal.id, file, textoOpcional, tipo);
      const msgConEstado = {
        ...nuevoMensaje,
        leido: false,
        entregado: Boolean(nuevoMensaje.entregado || isDestOnline)
      };

      setMensajes(prev => {
        const exists = prev.some(m => Number(m.id) === Number(msgConEstado.id));
        return exists ? prev : [...prev, msgConEstado];
      });

      setCanales(prev => {
        const target = prev.find(c => Number(c.id) === Number(canal.id));
        if (target) {
          const updated = { ...target, ultimo_mensaje: msgConEstado };
          const others = prev.filter(c => Number(c.id) !== Number(canal.id));
          return [updated, ...others];
        } else {
          return [{ ...canal, ultimo_mensaje: msgConEstado }, ...prev];
        }
      });
      return msgConEstado;
    } catch (err) {
      console.error('Error al enviar archivo adjunto interno:', err);
      throw err;
    }
  }, []);

  // 6.1 Enviar Sticker
  const enviarSticker = useCallback(async (stickerUrl) => {
    const canal = canalActivoRef.current;
    if (!canal || !stickerUrl) return;

    try {
      const isDestOnline = canal.tipo === 'directo' ? Boolean(canal.otro_participante?.esta_online) : false;
      const nuevoMensaje = await chatInternoService.enviarSticker(canal.id, stickerUrl);
      const msgConEstado = {
        ...nuevoMensaje,
        leido: false,
        entregado: Boolean(nuevoMensaje.entregado || isDestOnline)
      };

      setMensajes(prev => {
        const exists = prev.some(m => Number(m.id) === Number(msgConEstado.id));
        return exists ? prev : [...prev, msgConEstado];
      });

      setCanales(prev => {
        const target = prev.find(c => Number(c.id) === Number(canal.id));
        if (target) {
          const updated = { ...target, ultimo_mensaje: msgConEstado };
          const others = prev.filter(c => Number(c.id) !== Number(canal.id));
          return [updated, ...others];
        } else {
          return [{ ...canal, ultimo_mensaje: msgConEstado }, ...prev];
        }
      });
      return msgConEstado;
    } catch (err) {
      console.error('Error al enviar sticker:', err);
      throw err;
    }
  }, []);

  // 7. Alternar Reacción con Emoji
  const toggleReaccion = useCallback(async (mensajeId, emoji) => {
    const canal = canalActivoRef.current;
    if (!canal) return;

    try {
      const res = await chatInternoService.toggleReaccion(mensajeId, emoji, canal.id);
      setMensajes(prev =>
        prev.map(m => Number(m.id) === Number(mensajeId) ? { ...m, reacciones: res.reacciones } : m)
      );
      if (res?.ultimaReaccion) {
        setCanales(prev => {
          const target = prev.find(c => Number(c.id) === Number(canal.id));
          if (!target) return prev;
          const updated = { ...target, ultima_reaccion: res.ultimaReaccion };
          const others = prev.filter(c => Number(c.id) !== Number(canal.id));
          return [updated, ...others];
        });
      }
    } catch (err) {
      console.error('Error al alternar reacción:', err);
    }
  }, []);

  // 7.1 Editar mensaje
  const editarMensaje = useCallback(async (mensajeId, nuevoTexto) => {
    try {
      const res = await chatInternoService.editarMensaje(mensajeId, nuevoTexto);
      setMensajes(prev =>
        prev.map(m => Number(m.id) === Number(mensajeId) ? { ...m, mensaje: res.mensaje, editado_en: res.editado_en } : m)
      );
      setCanales(prev =>
        prev.map(c => {
          if (c.ultimo_mensaje && Number(c.ultimo_mensaje.id) === Number(mensajeId)) {
            return {
              ...c,
              ultimo_mensaje: { ...c.ultimo_mensaje, mensaje: res.mensaje, editado_en: res.editado_en }
            };
          }
          return c;
        })
      );
      return res;
    } catch (err) {
      console.error('Error al editar mensaje:', err);
      throw err;
    }
  }, []);

  // 7.2 Alternar Fijar Mensaje (solamente un mensaje fijado a la vez)
  const toggleFijarMensaje = useCallback(async (mensajeId, duracion = '7d') => {
    try {
      const res = await chatInternoService.toggleFijarMensaje(mensajeId, duracion);
      setMensajes(prev =>
        prev.map(m => {
          if (Number(m.id) === Number(mensajeId)) {
            return { ...m, fijado: res.fijado, fijado_por: res.fijado_por, fijado_en: res.fijado_en, fijado_hasta: res.fijado_hasta };
          }
          if (res.fijado) {
            return { ...m, fijado: false, fijado_por: null, fijado_en: null, fijado_hasta: null };
          }
          return m;
        })
      );
      return res;
    } catch (err) {
      console.error('Error al alternar fijar mensaje:', err);
      throw err;
    }
  }, []);

  // 7.3 Eliminar Mensaje (para todos)
  const eliminarMensaje = useCallback(async (mensajeId) => {
    try {
      const res = await chatInternoService.eliminarMensaje(mensajeId);
      setMensajes(prev =>
        prev.map(m => Number(m.id) === Number(mensajeId) ? { ...m, mensaje: res.mensaje, eliminado: true } : m)
      );
      setCanales(prev =>
        prev.map(c => {
          if (c.ultimo_mensaje && Number(c.ultimo_mensaje.id) === Number(mensajeId)) {
            return {
              ...c,
              ultimo_mensaje: { ...c.ultimo_mensaje, mensaje: res.mensaje, eliminado: true }
            };
          }
          return c;
        })
      );
      return res;
    } catch (err) {
      console.error('Error al eliminar mensaje:', err);
      throw err;
    }
  }, []);

  // 7.4 Destacar / Desmarcar Mensaje (Personal estilo WhatsApp)
  const toggleDestacarMensaje = useCallback(async (mensajeId) => {
    try {
      const res = await chatInternoService.toggleDestacarMensaje(mensajeId);
      setMensajes(prev =>
        prev.map(m =>
          Number(m.id) === Number(mensajeId) ? { ...m, destacado: res.destacado } : m
        )
      );
      return res;
    } catch (err) {
      console.error('Error al alternar destacar mensaje:', err);
      throw err;
    }
  }, []);

  // 7.4 Salir de la conversación (Esc como en WhatsApp)
  const deseleccionarCanal = useCallback(() => {
    if (socket && canalActivoRef.current) {
      socket.emit('chat_interno:leave_canal', { canalId: canalActivoRef.current.id });
    }
    setCanalActivo(null);
    setMensajes([]);
  }, [socket]);

  // 8. Notificar que está escribiendo
  const emitTyping = useCallback(() => {
    const canal = canalActivoRef.current;
    if (!socket || !canal || !user || canal.soy_miembro_activo === false) return;

    socket.emit('chat_interno:typing', {
      canalId: canal.id,
      agenteNombre: user.nombre,
      agenteId: user.id
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat_interno:stop_typing', {
        canalId: canal.id,
        agenteId: user.id
      });
    }, 2500);
  }, [socket, user]);

  // 9. Sincronización de presencia activa
  const aplicarListaActivos = useCallback((activeIds) => {
    if (!Array.isArray(activeIds)) return;
    const activeSet = new Set(activeIds.map(Number));

    setContactos(prev =>
      prev.map(c => ({
        ...c,
        esta_online: activeSet.has(Number(c.id)),
      }))
    );

    setCanales(prev =>
      prev.map(c => {
        if (c.tipo === 'directo' && c.otro_participante) {
          return {
            ...c,
            otro_participante: {
              ...c.otro_participante,
              esta_online: activeSet.has(Number(c.otro_participante.id)),
            },
          };
        }
        return c;
      })
    );

    setCanalActivo(prev => {
      if (prev && prev.tipo === 'directo' && prev.otro_participante) {
        return {
          ...prev,
          otro_participante: {
            ...prev.otro_participante,
            esta_online: activeSet.has(Number(prev.otro_participante.id)),
          },
        };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const handlePresenciaPolling = (e) => {
      if (e.detail) {
        aplicarListaActivos(e.detail);
      }
    };
    window.addEventListener('agentes:presencia_polling', handlePresenciaPolling);
    return () => window.removeEventListener('agentes:presencia_polling', handlePresenciaPolling);
  }, [aplicarListaActivos]);

  // 10. WebSockets en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      socket.emit('agentes:pedir_activos');
      if (user?.id) {
        socket.emit('agente:join', { id: user.id, rol: user.rol, area: user.area });
      }
      const cid = canalActivoRef.current?.id;
      if (cid && canalActivoRef.current?.soy_miembro_activo !== false) {
        socket.emit('chat_interno:join_canal', { canalId: cid, agenteId: user?.id });
      }
    };

    socket.emit('agentes:pedir_activos');
    if (socket.connected) {
      handleConnect();
    }
    socket.on('connect', handleConnect);

    const handleFuisteRemovido = ({ canalId, canalNombre, agenteIdRemovido, removidoPorNombre }) => {
      if (Number(agenteIdRemovido) === Number(user?.id)) {
        setCanales(prev =>
          prev.map(c => c.id === canalId ? { ...c, soy_miembro_activo: false } : c)
        );
        setCanalActivo(prev => {
          if (prev && prev.id === canalId) {
            return { ...prev, soy_miembro_activo: false };
          }
          return prev;
        });

        socket.emit('chat_interno:leave_canal', { canalId });
        notify('Chat Interno', `Has sido removido del canal #${canalNombre} por ${removidoPorNombre}.`);
      }
    };

    const handleNuevoMensaje = ({ canalId, mensaje }) => {
      const cid = Number(canalId);
      const eid = Number(mensaje?.emisor_id);

      // Enviar acuse de recibo de entrega al emisor (2 palomitas grises)
      if (eid && eid !== Number(user?.id)) {
        socket.emit('chat_interno:ack_entrega', { canalId: cid, mensajeId: mensaje?.id, emisorId: eid });
      }

      // Limpiar estado escribiendo para este emisor en este canal
      setEscribiendoMap(prev => {
        if (!prev[cid] || !prev[cid][eid]) return prev;
        const copy = { ...prev[cid] };
        delete copy[eid];
        return { ...prev, [cid]: copy };
      });

      const activo = canalActivoRef.current;
      if (activo && Number(activo.id) === cid) {
        // SI FUI REMOVIDO DE ESTE CANAL, IGNORAR CUALQUIER MENSAJE NUEVO
        if (activo.soy_miembro_activo === false) return;

        setMensajes(prev => {
          if (prev.some(m => Number(m.id) === Number(mensaje.id))) return prev;
          return [...prev, mensaje];
        });

        if (eid !== Number(user?.id)) {
          chatInternoService.marcarLeido(canalId, mensaje.id).catch(() => {});
          if (lastSoundMsgIdRef.current !== Number(mensaje.id)) {
            lastSoundMsgIdRef.current = Number(mensaje.id);
            reproducirSonidoWhatsAppInChat();
          }
        }
      }

      // Actualizar el canal en canales y posicionarlo al inicio
      setCanales(prev => {
        const target = prev.find(c => Number(c.id) === cid);
        if (target) {
          const updated = { ...target, ultimo_mensaje: mensaje };
          const others = prev.filter(c => Number(c.id) !== cid);
          return [updated, ...others];
        }
        return prev;
      });
    };

    const handleNotificacionMensaje = ({ canalId, mensaje, emisorId, miembros }) => {
      // SI HAY LISTA DE MIEMBROS ACTIVOS Y NO ESTOY INCLUIDO, IGNORAR
      if (Array.isArray(miembros) && !miembros.map(Number).includes(Number(user?.id))) {
        return;
      }

      // Emitir acuse de recibo para confirmar que llegó la notificación al dispositivo
      if (Number(emisorId) !== Number(user?.id)) {
        socket.emit('chat_interno:ack_entrega', { canalId: Number(canalId), mensajeId: mensaje?.id, emisorId: Number(emisorId) });
      }

      const activo = canalActivoRef.current;
      const esActivo = activo && Number(activo.id) === Number(canalId);

      // Si el canal está abierto activamente en pantalla, garantizar que el mensaje esté en la lista y reproducir el tono in-chat
      if (esActivo && mensaje) {
        if (activo.soy_miembro_activo !== false) {
          setMensajes(prev => {
            if (prev.some(m => Number(m.id) === Number(mensaje.id))) return prev;
            return [...prev, mensaje];
          });
          if (Number(emisorId) !== Number(user?.id)) {
            chatInternoService.marcarLeido(canalId, mensaje.id).catch(() => {});
            if (lastSoundMsgIdRef.current !== Number(mensaje.id)) {
              lastSoundMsgIdRef.current = Number(mensaje.id);
              reproducirSonidoWhatsAppInChat();
            }
          }
        }
      } else if (Number(emisorId) !== Number(user?.id)) {
        notificarMensajeCanal(user?.id, canalId);
      }

      setCanales(prev => {
        const target = prev.find(c => Number(c.id) === Number(canalId));
        if (!target) return prev;
        if (target.soy_miembro_activo === false) return prev;
        const updated = {
          ...target,
          ultimo_mensaje: mensaje,
          unread_count: (!esActivo && Number(emisorId) !== Number(user?.id)) ? (target.unread_count || 0) + 1 : 0,
        };
        const others = prev.filter(c => Number(c.id) !== Number(canalId));
        return [updated, ...others];
      });
    };

    const handleReaccionActualizada = ({ canalId, mensajeId, reacciones, ultimaReaccion }) => {
      const cid = Number(canalId);
      const mid = Number(mensajeId);

      const activo = canalActivoRef.current;
      if (activo && Number(activo.id) === cid) {
        setMensajes(prev =>
          prev.map(m => Number(m.id) === mid ? { ...m, reacciones } : m)
        );
      }

      setCanales(prev => {
        const target = prev.find(c => Number(c.id) === cid);
        if (!target) return prev;
        const updated = {
          ...target,
          ...(ultimaReaccion ? { ultima_reaccion: ultimaReaccion } : {})
        };
        if (ultimaReaccion) {
          const others = prev.filter(c => Number(c.id) !== cid);
          return [updated, ...others];
        }
        return prev.map(c => Number(c.id) === cid ? updated : c);
      });
    };

    const handleMensajeEditado = ({ canalId, mensajeId, mensaje, editado_en }) => {
      const cid = Number(canalId);
      const mid = Number(mensajeId);

      const activo = canalActivoRef.current;
      if (activo && Number(activo.id) === cid) {
        setMensajes(prev => prev.map(m => Number(m.id) === mid ? { ...m, mensaje, editado_en } : m));
      }

      setCanales(prev =>
        prev.map(c => {
          if (c.ultimo_mensaje && Number(c.ultimo_mensaje.id) === mid) {
            return {
              ...c,
              ultimo_mensaje: { ...c.ultimo_mensaje, mensaje, editado_en }
            };
          }
          return c;
        })
      );
    };

    const handleMensajeFijado = ({ canalId, mensajeId, fijado, fijado_por, fijado_en, fijado_hasta }) => {
      const cid = Number(canalId);
      const mid = Number(mensajeId);

      const activo = canalActivoRef.current;
      if (activo && Number(activo.id) === cid) {
        setMensajes(prev => prev.map(m => {
          if (Number(m.id) === mid) {
            return { ...m, fijado, fijado_por, fijado_en, fijado_hasta };
          }
          if (fijado) {
            return { ...m, fijado: false, fijado_por: null, fijado_en: null, fijado_hasta: null };
          }
          return m;
        }));
      }
    };

    const handleMensajeEliminado = ({ canalId, mensajeId, mensaje, eliminado }) => {
      const cid = Number(canalId);
      const mid = Number(mensajeId);

      const activo = canalActivoRef.current;
      if (activo && Number(activo.id) === cid) {
        setMensajes(prev => prev.map(m => Number(m.id) === mid ? { ...m, mensaje, eliminado: true } : m));
      }

      setCanales(prev =>
        prev.map(c => {
          if (c.ultimo_mensaje && Number(c.ultimo_mensaje.id) === mid) {
            return {
              ...c,
              ultimo_mensaje: { ...c.ultimo_mensaje, mensaje, eliminado: true }
            };
          }
          return c;
        })
      );
    };

    const handleCanalCreado = (nuevoCanal) => {
      if (!nuevoCanal || !nuevoCanal.id) return;
      setCanales(prev => {
        if (prev.some(c => Number(c.id) === Number(nuevoCanal.id))) return prev;
        return [nuevoCanal, ...prev];
      });
    };

    const handleCanalEliminado = ({ canalId, nombre }) => {
      setCanales(prev =>
        prev.map(c => c.id === canalId ? { ...c, canal_eliminado: true, soy_miembro_activo: false } : c)
      );
      setCanalActivo(prev => {
        if (prev && prev.id === canalId) {
          return { ...prev, canal_eliminado: true, soy_miembro_activo: false };
        }
        return prev;
      });
      notify('Chat Interno', `El canal #${nombre} fue cerrado por un administrador.`);
    };

    const handleTyping = ({ canalId, agenteNombre, agenteId }) => {
      if (!canalId || !agenteId) return;
      const aid = Number(agenteId);
      if (aid === Number(user?.id)) return;

      const cid = Number(canalId);

      setEscribiendoMap(prev => {
        const canalData = prev[cid] || {};
        return {
          ...prev,
          [cid]: {
            ...canalData,
            [aid]: agenteNombre || 'Compañero'
          }
        };
      });

      // Timeout de seguridad: si no llega stop_typing en 3.5 segundos, limpiar
      const timerKey = `${cid}_${aid}`;
      if (typingTimersRef.current[timerKey]) {
        clearTimeout(typingTimersRef.current[timerKey]);
      }
      typingTimersRef.current[timerKey] = setTimeout(() => {
        setEscribiendoMap(prev => {
          if (!prev[cid] || !prev[cid][aid]) return prev;
          const copy = { ...prev[cid] };
          delete copy[aid];
          return { ...prev, [cid]: copy };
        });
        delete typingTimersRef.current[timerKey];
      }, 3500);
    };

    const handleStopTyping = ({ canalId, agenteId }) => {
      if (!canalId || !agenteId) return;
      const cid = Number(canalId);
      const aid = Number(agenteId);

      const timerKey = `${cid}_${aid}`;
      if (typingTimersRef.current[timerKey]) {
        clearTimeout(typingTimersRef.current[timerKey]);
        delete typingTimersRef.current[timerKey];
      }

      setEscribiendoMap(prev => {
        if (!prev[cid] || !prev[cid][aid]) return prev;
        const copy = { ...prev[cid] };
        delete copy[aid];
        return { ...prev, [cid]: copy };
      });
    };

    const handleAgenteOnline = ({ id, estado_presencia, mensaje_presencia }) => {
      setContactos(prev => prev.map(c => 
        Number(c.id) === Number(id)
          ? {
              ...c,
              esta_online: true,
              estado_presencia: estado_presencia || c.estado_presencia || 'disponible',
              mensaje_presencia: mensaje_presencia !== undefined ? mensaje_presencia : c.mensaje_presencia
            }
          : c
      ));
      setCanales(prev => prev.map(c => {
        if (c.tipo === 'directo' && Number(c.otro_participante?.id) === Number(id)) {
          return {
            ...c,
            otro_participante: {
              ...c.otro_participante,
              esta_online: true,
              estado_presencia: estado_presencia || c.otro_participante?.estado_presencia || 'disponible',
              mensaje_presencia: mensaje_presencia !== undefined ? mensaje_presencia : c.otro_participante?.mensaje_presencia
            }
          };
        }
        return c;
      }));
      setCanalActivo(prev => {
        if (prev?.tipo === 'directo' && Number(prev.otro_participante?.id) === Number(id)) {
          return {
            ...prev,
            otro_participante: {
              ...prev.otro_participante,
              esta_online: true,
              estado_presencia: estado_presencia || prev.otro_participante?.estado_presencia || 'disponible',
              mensaje_presencia: mensaje_presencia !== undefined ? mensaje_presencia : prev.otro_participante?.mensaje_presencia
            }
          };
        }
        return prev;
      });
      if (canalActivoRef.current?.tipo === 'directo' && Number(canalActivoRef.current?.otro_participante?.id) === Number(id)) {
        setMensajes(prev => prev.map(m => Number(m.emisor_id) === Number(user?.id) && !m.leido ? { ...m, entregado: true } : m));
      }
    };

    const handleMensajesLeidos = ({ canalId, agenteId, ultimoMensajeId, tipo, lecturas, miembros_activos }) => {
      const cid = Number(canalId);
      const aid = Number(agenteId);
      const uid = Number(user?.id);

      if (aid === uid) return;

      if (canalActivoRef.current && Number(canalActivoRef.current.id) === cid) {
        setMensajes(prev => prev.map(m => {
          const isOwn = Number(m.emisor_id) === uid;
          if (!isOwn) return m;

          // Si es chat directo
          if (tipo === 'directo' || canalActivoRef.current?.tipo === 'directo') {
            const isRead = (!ultimoMensajeId || Number(m.id) <= Number(ultimoMensajeId));
            return {
              ...m,
              leido: isRead || m.leido,
              entregado: true,
              leidos_count: isRead ? 1 : (m.leidos_count || 0),
              total_destinatarios: 1
            };
          }

          // Si es grupo o canal
          if (lecturas && Array.isArray(miembros_activos)) {
            const destinatarios = miembros_activos.filter(id => Number(id) !== uid);
            const total = destinatarios.length;
            const leidosCount = destinatarios.filter(id => (Number(lecturas[id]) || 0) >= Number(m.id)).length;
            const isTodosLeidos = total > 0 && leidosCount >= total;

            let nuevosLectores = Array.isArray(m.lectores) ? [...m.lectores] : [];
            if ((Number(lecturas[aid]) || 0) >= Number(m.id) && !nuevosLectores.some(l => Number(l.id) === aid)) {
              const contacto = contactosRef.current?.find(ct => Number(ct.id) === aid);
              nuevosLectores.push({
                id: aid,
                nombre: contacto?.nombre || 'Miembro',
                foto_perfil: contacto?.foto_perfil || null,
                leido_en: new Date().toISOString()
              });
            }

            return {
              ...m,
              leido: isTodosLeidos,
              leidos_count: leidosCount,
              total_destinatarios: total,
              lectores: nuevosLectores,
              entregado: true
            };
          }

          return { ...m, entregado: true };
        }));
      }

      setCanales(prev => prev.map(c => {
        if (Number(c.id) === cid && c.ultimo_mensaje && Number(c.ultimo_mensaje.emisor_id) === uid) {
          if (tipo === 'directo' || c.tipo === 'directo') {
            const isRead = (!ultimoMensajeId || Number(c.ultimo_mensaje.id) <= Number(ultimoMensajeId));
            return {
              ...c,
              ultimo_mensaje: {
                ...c.ultimo_mensaje,
                leido: isRead,
                entregado: true,
                leidos_count: isRead ? 1 : 0,
                total_destinatarios: 1
              }
            };
          } else if (lecturas && Array.isArray(miembros_activos)) {
            const destinatarios = miembros_activos.filter(id => Number(id) !== uid);
            const total = destinatarios.length;
            const lastId = Number(c.ultimo_mensaje.id);
            const leidosCount = destinatarios.filter(id => (Number(lecturas[id]) || 0) >= lastId).length;
            const isTodosLeidos = total > 0 && leidosCount >= total;

            return {
              ...c,
              ultimo_mensaje: {
                ...c.ultimo_mensaje,
                leido: isTodosLeidos,
                leidos_count: leidosCount,
                total_destinatarios: total,
                entregado: true
              }
            };
          }
        }
        return c;
      }));
    };

    const handleAgenteOffline = ({ id }) => {
      setContactos(prev => prev.map(c => Number(c.id) === Number(id) ? { ...c, esta_online: false } : c));
      setCanales(prev => prev.map(c => {
        if (c.tipo === 'directo' && Number(c.otro_participante?.id) === Number(id)) {
          return { ...c, otro_participante: { ...c.otro_participante, esta_online: false } };
        }
        return c;
      }));
      setCanalActivo(prev => {
        if (prev?.tipo === 'directo' && Number(prev.otro_participante?.id) === Number(id)) {
          return { ...prev, otro_participante: { ...prev.otro_participante, esta_online: false } };
        }
        return prev;
      });
    };

    const handleActiveList = (activeIds) => {
      aplicarListaActivos(activeIds);
    };

    const handleMensajeEntregado = ({ canalId, mensajeId, emisorId }) => {
      const cid = Number(canalId);
      const mid = Number(mensajeId);
      const eid = Number(emisorId);

      // Si el emisor soy yo, actualizar mis mensajes a entregado (2 palomitas grises)
      if (!eid || eid === Number(user?.id)) {
        if (canalActivoRef.current && Number(canalActivoRef.current.id) === cid) {
          setMensajes(prev => prev.map(m => {
            if (Number(m.emisor_id) === Number(user?.id) && (!mid || Number(m.id) <= mid)) {
              return { ...m, entregado: true };
            }
            return m;
          }));
        }

        setCanales(prev => prev.map(c => {
          if (Number(c.id) === cid && c.ultimo_mensaje && Number(c.ultimo_mensaje.emisor_id) === Number(user?.id)) {
            return {
              ...c,
              ultimo_mensaje: { ...c.ultimo_mensaje, entregado: true }
            };
          }
          return c;
        }));
      }
    };

    const handlePresenciaCambiada = ({ id, estado_presencia, mensaje_presencia }) => {
      setContactos(prev => prev.map(c => 
        Number(c.id) === Number(id) ? { ...c, estado_presencia, mensaje_presencia, esta_online: true } : c
      ));
      setCanales(prev => prev.map(c => {
        if (c.tipo === 'directo' && Number(c.otro_participante?.id) === Number(id)) {
          return {
            ...c,
            otro_participante: {
              ...c.otro_participante,
              estado_presencia,
              mensaje_presencia,
              esta_online: true
            }
          };
        }
        return c;
      }));
      setCanalActivo(prev => {
        if (prev?.tipo === 'directo' && Number(prev.otro_participante?.id) === Number(id)) {
          return {
            ...prev,
            otro_participante: {
              ...prev.otro_participante,
              estado_presencia,
              mensaje_presencia,
              esta_online: true
            }
          };
        }
        return prev;
      });

      // Disparar evento global para sincronizar TopBar, Sidebar, etc.
      try {
        window.dispatchEvent(new CustomEvent('sistema:presencia_cambiada', {
          detail: { id: Number(id), estado_presencia, mensaje_presencia }
        }));
      } catch (_) {}
    };

    const handleAnfitrionCambiado = ({ canalId, canalNombre, nuevoAnfitrion }) => {
      setCanales(prev =>
        prev.map(c => c.id === canalId ? { ...c, creador_id: nuevoAnfitrion.id } : c)
      );
      setCanalActivo(prev => {
        if (prev && prev.id === canalId) {
          return { ...prev, creador_id: nuevoAnfitrion.id };
        }
        return prev;
      });

      const channelTag = canalNombre ? ` #${canalNombre}` : '';
      if (Number(nuevoAnfitrion.id) === Number(user?.id)) {
        notify('Administrador Anfitrión', `¡Has sido nombrado Administrador Anfitrión del canal${channelTag}!`);
      } else {
        notify('Administrador Anfitrión', `${nuevoAnfitrion.nombre} es ahora el Administrador Anfitrión del canal${channelTag}.`);
      }
      cargarDatos();
    };

    const handleRolCambiado = ({ canalId, canalNombre, agenteId, nuevoRol, asignadoPorNombre }) => {
      if (Number(agenteId) === Number(user?.id)) {
        if (nuevoRol === 'admin') {
          notify('Permisos Actualizados', `¡Has sido nombrado Administrador del canal #${canalNombre}!`);
        } else {
          notify('Permisos Actualizados', `Tu rol en el canal #${canalNombre} ahora es Miembro.`);
        }
        cargarDatos();
      }
    };

    const handleMiembroAgregado = ({ canalId, canalNombre, agenteId, agregadoPorNombre }) => {
      if (Number(agenteId) === Number(user?.id)) {
        notify('Nuevo Canal', `Has sido agregado al canal #${canalNombre} por ${agregadoPorNombre || 'un administrador'}.`);
        cargarDatos();
      }
    };

    const handleCanalActualizado = ({ canalId, canal }) => {
      setCanales(prev =>
        prev.map(c => c.id === canalId ? { ...c, ...canal } : c)
      );
      setCanalActivo(prev => {
        if (prev && prev.id === canalId) {
          return { ...prev, ...canal };
        }
        return prev;
      });
    };

    socket.on('chat_interno:fuiste_removido', handleFuisteRemovido);
    socket.on('chat_interno:anfitrion_cambiado', handleAnfitrionCambiado);
    socket.on('chat_interno:rol_cambiado', handleRolCambiado);
    socket.on('chat_interno:miembro_agregado', handleMiembroAgregado);
    socket.on('chat_interno:canal_actualizado', handleCanalActualizado);
    socket.on('chat_interno:nuevo_mensaje', handleNuevoMensaje);
    socket.on('chat_interno:notificacion_mensaje', handleNotificacionMensaje);
    socket.on('chat_interno:reaccion_actualizada', handleReaccionActualizada);
    socket.on('chat_interno:notificacion_reaccion', handleReaccionActualizada);
    socket.on('chat_interno:mensaje_editado', handleMensajeEditado);
    socket.on('chat_interno:mensaje_editado_global', handleMensajeEditado);
    socket.on('chat_interno:mensaje_fijado', handleMensajeFijado);
    socket.on('chat_interno:mensaje_eliminado', handleMensajeEliminado);
    socket.on('chat_interno:mensaje_eliminado_global', handleMensajeEliminado);
    socket.on('chat_interno:canal_creado', handleCanalCreado);
    socket.on('chat_interno:canal_eliminado', handleCanalEliminado);
    socket.on('chat_interno:typing', handleTyping);
    socket.on('chat_interno:stop_typing', handleStopTyping);
    socket.on('agente:online', handleAgenteOnline);
    socket.on('agente:offline', handleAgenteOffline);
    socket.on('agente:presencia_cambiada', handlePresenciaCambiada);
    socket.on('agentes:active_list', handleActiveList);
    socket.on('chat_interno:mensajes_leidos', handleMensajesLeidos);
    socket.on('chat_interno:mensaje_entregado', handleMensajeEntregado);

    return () => {
      socket.off('chat_interno:fuiste_removido', handleFuisteRemovido);
      socket.off('chat_interno:anfitrion_cambiado', handleAnfitrionCambiado);
      socket.off('chat_interno:rol_cambiado', handleRolCambiado);
      socket.off('chat_interno:miembro_agregado', handleMiembroAgregado);
      socket.off('chat_interno:canal_actualizado', handleCanalActualizado);
      socket.off('chat_interno:nuevo_mensaje', handleNuevoMensaje);
      socket.off('chat_interno:notificacion_mensaje', handleNotificacionMensaje);
      socket.off('chat_interno:reaccion_actualizada', handleReaccionActualizada);
      socket.off('chat_interno:notificacion_reaccion', handleReaccionActualizada);
      socket.off('chat_interno:mensaje_editado', handleMensajeEditado);
      socket.off('chat_interno:mensaje_editado_global', handleMensajeEditado);
      socket.off('chat_interno:mensaje_fijado', handleMensajeFijado);
      socket.off('chat_interno:mensaje_eliminado', handleMensajeEliminado);
      socket.off('chat_interno:mensaje_eliminado_global', handleMensajeEliminado);
      socket.off('chat_interno:canal_creado', handleCanalCreado);
      socket.off('chat_interno:canal_eliminado', handleCanalEliminado);
      socket.off('chat_interno:typing', handleTyping);
      socket.off('chat_interno:stop_typing', handleStopTyping);
      socket.off('agente:online', handleAgenteOnline);
      socket.off('agente:offline', handleAgenteOffline);
      socket.off('agente:presencia_cambiada', handlePresenciaCambiada);
      socket.off('agentes:active_list', handleActiveList);
      socket.off('chat_interno:mensajes_leidos', handleMensajesLeidos);
      socket.off('chat_interno:mensaje_entregado', handleMensajeEntregado);
      socket.off('connect', handleConnect);
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
    };
  }, [socket, user, aplicarListaActivos]);

  return {
    canales,
    contactos,
    canalActivo,
    mensajes,
    cargando,
    cargandoMensajes,
    escribiendoMap,
    seleccionarCanal,
    deseleccionarCanal,
    abrirChatDirecto,
    crearCanal,
    eliminarCanal,
    ocultarConversacion,
    toggleFijarCanal,
    enviarTexto,
    enviarAdjunto,
    enviarSticker,
    editarMensaje,
    toggleFijarMensaje,
    eliminarMensaje,
    toggleDestacarMensaje,
    toggleReaccion,
    emitTyping,
    recargar: cargarDatos,
  };
}
