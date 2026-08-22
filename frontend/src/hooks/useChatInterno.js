/**
 * @file useChatInterno.js
 * @description Hook personalizado para gestionar el estado, presencia instantánea,
 * reacciones con emojis, control estricto de membresía y WebSockets del Chat Interno Corporativo.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotifications } from './useNotifications';
import { chatInternoService } from '../services/chatInterno.service';

export function useChatInterno({ socket, user, canalInicialId }) {
  const { notify } = useNotifications();
  const [canales, setCanales] = useState([]);
  const canalesRef = useRef(canales);
  useEffect(() => { canalesRef.current = canales; }, [canales]);
  const [contactos, setContactos] = useState([]);
  const [canalActivo, setCanalActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [escribiendoMap, setEscribiendoMap] = useState({});

  const canalActivoRef = useRef(canalActivo);
  useEffect(() => {
    canalActivoRef.current = canalActivo;
  }, [canalActivo]);

  const typingTimeoutRef = useRef(null);

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

      if (!canalActivoRef.current && listCanales.length > 0) {
        seleccionarCanal(listCanales[0]);
      }
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
    setEscribiendoMap({});
    setCargandoMensajes(true);

    // Solo unirse a la sala en tiempo real si es miembro activo
    if (socket && canal.soy_miembro_activo !== false) {
      socket.emit('chat_interno:join_canal', { canalId: canal.id, agenteId: user?.id });
    }

    try {
      const data = await chatInternoService.getMensajes(canal.id);
      setMensajes(data.mensajes || []);

      if (data.mensajes && data.mensajes.length > 0 && canal.soy_miembro_activo !== false) {
        const lastMsg = data.mensajes[data.mensajes.length - 1];
        await chatInternoService.marcarLeido(canal.id, lastMsg.id);
      }

      setCanales(prev =>
        prev.map(c => c.id === canal.id ? { ...c, unread_count: 0 } : c)
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
        const exists = prev.find(c => c.id === canal.id);
        if (!exists) return [canal, ...prev];
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
  const crearCanal = useCallback(async ({ nombre, descripcion, esPrivado, soloLectura, miembroIds }) => {
    try {
      const nuevoCanal = await chatInternoService.crearCanal({
        nombre,
        descripcion,
        esPrivado,
        soloLectura,
        miembroIds,
      });

      setCanales(prev => [nuevoCanal, ...prev]);
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
      const nuevoMensaje = await chatInternoService.enviarMensajeTexto(canal.id, texto.trim());
      setMensajes(prev => {
        const exists = prev.some(m => m.id === nuevoMensaje.id);
        return exists ? prev : [...prev, nuevoMensaje];
      });

      setCanales(prev =>
        prev.map(c => c.id === canal.id ? { ...c, ultimo_mensaje: nuevoMensaje } : c)
      );
    } catch (err) {
      console.error('Error al enviar mensaje de texto interno:', err);
      throw err;
    }
  }, [socket, user]);

  // 6. Enviar archivo adjunto
  const enviarAdjunto = useCallback(async (file, textoOpcional = '') => {
    const canal = canalActivoRef.current;
    if (!canal || !file) return;

    try {
      const nuevoMensaje = await chatInternoService.enviarMensajeAdjunto(canal.id, file, textoOpcional);
      setMensajes(prev => {
        const exists = prev.some(m => m.id === nuevoMensaje.id);
        return exists ? prev : [...prev, nuevoMensaje];
      });

      setCanales(prev =>
        prev.map(c => c.id === canal.id ? { ...c, ultimo_mensaje: nuevoMensaje } : c)
      );
    } catch (err) {
      console.error('Error al enviar archivo adjunto interno:', err);
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
        prev.map(m => m.id === mensajeId ? { ...m, reacciones: res.reacciones } : m)
      );
    } catch (err) {
      console.error('Error al alternar reacción:', err);
    }
  }, []);

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

    socket.emit('agentes:pedir_activos');

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
      const activo = canalActivoRef.current;
      if (activo && activo.id === canalId) {
        // SI FUI REMOVIDO DE ESTE CANAL, IGNORAR CUALQUIER MENSAJE NUEVO
        if (activo.soy_miembro_activo === false) return;

        setMensajes(prev => {
          if (prev.some(m => m.id === mensaje.id)) return prev;
          return [...prev, mensaje];
        });

        if (mensaje.emisor_id !== user?.id) {
          chatInternoService.marcarLeido(canalId, mensaje.id).catch(() => {});
        }
      }
    };

    const handleNotificacionMensaje = ({ canalId, mensaje, emisorId, miembros }) => {
      // SI HAY LISTA DE MIEMBROS ACTIVOS Y NO ESTOY INCLUIDO, IGNORAR
      if (Array.isArray(miembros) && !miembros.map(Number).includes(Number(user?.id))) {
        return;
      }

      const activo = canalActivoRef.current;
      const esActivo = activo && activo.id === canalId;

      setCanales(prev =>
        prev.map(c => {
          if (c.id === canalId) {
            if (c.soy_miembro_activo === false) return c;
            return {
              ...c,
              ultimo_mensaje: mensaje,
              unread_count: (!esActivo && emisorId !== user?.id) ? (c.unread_count || 0) + 1 : 0,
            };
          }
          return c;
        })
      );
    };

    const handleReaccionActualizada = ({ canalId, mensajeId, reacciones }) => {
      const activo = canalActivoRef.current;
      if (activo && activo.id === canalId) {
        setMensajes(prev =>
          prev.map(m => m.id === mensajeId ? { ...m, reacciones } : m)
        );
      }
    };

    const handleCanalCreado = (nuevoCanal) => {
      setCanales(prev => {
        if (prev.some(c => c.id === nuevoCanal.id)) return prev;
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
      const activo = canalActivoRef.current;
      if (activo && activo.id === canalId && agenteId !== user?.id && activo.soy_miembro_activo !== false) {
        setEscribiendoMap(prev => ({ ...prev, [agenteId]: agenteNombre }));
      }
    };

    const handleStopTyping = ({ canalId, agenteId }) => {
      const activo = canalActivoRef.current;
      if (activo && activo.id === canalId) {
        setEscribiendoMap(prev => {
          const next = { ...prev };
          delete next[agenteId];
          return next;
        });
      }
    };

    const handleAgenteOnline = ({ id }) => {
      setContactos(prev => prev.map(c => Number(c.id) === Number(id) ? { ...c, esta_online: true } : c));
      setCanales(prev => prev.map(c => {
        if (c.tipo === 'directo' && Number(c.otro_participante?.id) === Number(id)) {
          return { ...c, otro_participante: { ...c.otro_participante, esta_online: true } };
        }
        return c;
      }));
      setCanalActivo(prev => {
        if (prev?.tipo === 'directo' && Number(prev.otro_participante?.id) === Number(id)) {
          return { ...prev, otro_participante: { ...prev.otro_participante, esta_online: true } };
        }
        return prev;
      });
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
    };

    socket.on('chat_interno:fuiste_removido', handleFuisteRemovido);
    socket.on('chat_interno:nuevo_mensaje', handleNuevoMensaje);
    socket.on('chat_interno:notificacion_mensaje', handleNotificacionMensaje);
    socket.on('chat_interno:reaccion_actualizada', handleReaccionActualizada);
    socket.on('chat_interno:canal_creado', handleCanalCreado);
    socket.on('chat_interno:canal_eliminado', handleCanalEliminado);
    socket.on('chat_interno:typing', handleTyping);
    socket.on('chat_interno:stop_typing', handleStopTyping);
    socket.on('agente:online', handleAgenteOnline);
    socket.on('agente:offline', handleAgenteOffline);
    socket.on('agente:presencia_cambiada', handlePresenciaCambiada);
    socket.on('agentes:active_list', handleActiveList);

    return () => {
      socket.off('chat_interno:fuiste_removido', handleFuisteRemovido);
      socket.off('chat_interno:nuevo_mensaje', handleNuevoMensaje);
      socket.off('chat_interno:notificacion_mensaje', handleNotificacionMensaje);
      socket.off('chat_interno:reaccion_actualizada', handleReaccionActualizada);
      socket.off('chat_interno:canal_creado', handleCanalCreado);
      socket.off('chat_interno:canal_eliminado', handleCanalEliminado);
      socket.off('chat_interno:typing', handleTyping);
      socket.off('chat_interno:stop_typing', handleStopTyping);
      socket.off('agente:online', handleAgenteOnline);
      socket.off('agente:offline', handleAgenteOffline);
      socket.off('agente:presencia_cambiada', handlePresenciaCambiada);
      socket.off('agentes:active_list', handleActiveList);
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
    abrirChatDirecto,
    crearCanal,
    eliminarCanal,
    ocultarConversacion,
    enviarTexto,
    enviarAdjunto,
    toggleReaccion,
    emitTyping,
    recargar: cargarDatos,
  };
}
