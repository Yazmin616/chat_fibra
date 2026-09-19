/**
 * @file useNotificacionesCenter.js
 * @description Hook global para gestionar la bandeja de notificaciones estilo Facebook
 * y la ventana flotante de Messenger sincronizado con los mensajes no leídos del CRM.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatInternoService } from '../services/chatInterno.service';
import { mostrarNotificacionDesktop } from '../utils/desktopNotificationHelper';

const NOTIF_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

const getNotificacionesForUser = (userId) => {
  if (!userId) return [];
  try {
    const userSavedKey = `isp_notificaciones_user_${userId}`;
    const saved = localStorage.getItem(userSavedKey);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    // Deduplicar estrictamente por canalId para evitar entradas duplicadas
    const seenCanalIds = new Set();
    return parsed.filter(n => {
      if (!n.canalId) return true;
      const cid = Number(n.canalId);
      if (seenCanalIds.has(cid)) return false;
      seenCanalIds.add(cid);
      return true;
    });
  } catch {
    return [];
  }
};

export function useNotificacionesCenter({ socket, user, currentView, setCurrentView }) {
  const [notificaciones, setNotificaciones] = useState(() => getNotificacionesForUser(user?.id));
  const [floatingChats, setFloatingChats] = useState([]);
  const canalesMapRef = useRef(new Map());

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Guardar en localStorage estrictamente por usuario
  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.removeItem('isp_notificaciones_list');
      localStorage.removeItem('isp_notificaciones_center_v1');
      const key = `isp_notificaciones_user_${user.id}`;
      localStorage.setItem(key, JSON.stringify(notificaciones.slice(0, 50)));
    } catch {}
  }, [notificaciones, user?.id]);

  const reproducirSonido = useCallback(() => {
    try {
      const audio = new Audio(NOTIF_SOUND_URL);
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const agregarNotificacion = useCallback((notif) => {
    const cid = notif.canalId ? Number(notif.canalId) : null;
    const targetId = cid ? `canal_${cid}` : (notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const nueva = {
      tiempo: new Date().toISOString(),
      leida: false,
      ...notif,
      id: targetId,
      canalId: cid,
    };

    setNotificaciones(prev => {
      // Filtrar cualquier notificación existente que coincida por canalId O por targetId
      const filtrados = prev.filter(n => {
        if (cid && n.canalId && Number(n.canalId) === cid) return false;
        if (n.id === targetId) return false;
        return true;
      });
      return [nueva, ...filtrados].slice(0, 50);
    });

    reproducirSonido();

    mostrarNotificacionDesktop({
      titulo: nueva.titulo,
      cuerpo: nueva.cuerpo,
      emisorNombre: nueva.emisor_nombre,
      emisorFoto: nueva.emisor_foto,
      canalFoto: nueva.canalFoto,
      canalId: nueva.canalId,
      canalTipo: nueva.canalTipo,
      urlAdjunto: nueva.url_adjunto,
      tipoAdjunto: nueva.tipoAdjunto,
      onClick: () => {
        if (nueva.canalId && typeof setCurrentView === 'function') {
          setCurrentView('chat-interno');
        }
      },
    });

    return nueva;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproducirSonido, setCurrentView]);

  // Cargar canales iniciales para sincronizar mensajes no leídos
  const sincronizarCanalesNoLeidos = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const data = await chatInternoService.getCanales();
      const validCanalIds = new Set((data || []).map(c => Number(c.id)));
      canalesMapRef.current.clear();
      const unreadMap = {};
      const unreadNotifs = [];

      (data || []).forEach(c => {
        const cid = Number(c.id);
        canalesMapRef.current.set(cid, c);
        const count = Number(c.unread_count || 0);
        if (count > 0) {
          unreadMap[cid] = count;
          const esDirecto = c.tipo === 'directo' || Boolean(c.otro_participante);
          const titulo = esDirecto
            ? (c.otro_participante?.nombre || 'Chat Directo')
            : `#${(c.nombre || 'canal').replace(/^#+/, '')}`;
          const cuerpo = esDirecto
            ? (c.ultimo_mensaje?.tipo === 'imagen'
                ? '📷 Envió una imagen'
                : c.ultimo_mensaje?.tipo === 'archivo'
                  ? `📎 Envió un archivo: ${c.ultimo_mensaje.nombre_adjunto || ''}`
                  : (c.ultimo_mensaje?.mensaje || 'Mensajes pendientes en esta conversación'))
            : (c.ultimo_mensaje?.emisor_nombre
                ? `${c.ultimo_mensaje.emisor_nombre}: ${c.ultimo_mensaje.mensaje || 'Envió un adjunto'}`
                : (c.ultimo_mensaje?.mensaje || 'Mensajes pendientes en el canal'));

          unreadNotifs.push({
            id: `canal_${cid}`,
            titulo,
            cuerpo,
            emisor_nombre: titulo,
            emisor_foto: esDirecto ? c.otro_participante?.foto_perfil : null,
            canalFoto: esDirecto ? null : (c.foto || null),
            tipo: 'mensaje',
            canalTipo: esDirecto ? 'directo' : 'canal',
            canalId: cid,
            canalNombre: titulo,
            unread_count: count,
            tiempo: c.ultimo_mensaje?.created_at || c.created_at || new Date().toISOString(),
            leida: false,
          });
        }
      });

      const unreadCanalIds = new Set(unreadNotifs.map(n => Number(n.canalId)));
      const unreadIdsSet = new Set(unreadNotifs.map(n => n.id));

      setNotificaciones(prev => {
        const vistos = new Set(unreadCanalIds);
        const prevActualizados = [];

        prev.forEach(p => {
          const pCid = p.canalId ? Number(p.canalId) : null;
          // Descartar notificaciones de canales que no pertenecen al usuario
          if (pCid && !validCanalIds.has(pCid)) return;
          // Descartar versiones viejas de canales que ya vienen en unreadNotifs
          if (pCid && vistos.has(pCid)) return;
          if (unreadIdsSet.has(p.id)) return;

          if (pCid) {
            vistos.add(pCid);
            // Canal ya leído a 0 en la base de datos
            prevActualizados.push({ ...p, leida: true, unread_count: 0 });
          } else {
            // Eventos no ligados a canales (sistema, avisos)
            prevActualizados.push(p);
          }
        });

        return [...unreadNotifs, ...prevActualizados].slice(0, 50);
      });

      if (currentView !== 'chat-interno') {
        setFloatingChats(prev => {
          const map = new Map();

          // Preservar de prev únicamente canales que pertenecen al usuario
          prev.forEach(c => {
            const cid = Number(c.canalId);
            if (validCanalIds.has(cid)) {
              const dbCount = unreadMap[cid] || 0;
              const estaAbiertoYActivo = c.isOpen && !c.isMinimized;
              // Mantener si tiene no leídos o si está la ventana abierta
              if (dbCount > 0 || estaAbiertoYActivo) {
                map.set(cid, {
                  ...c,
                  unreadCount: estaAbiertoYActivo ? 0 : dbCount
                });
              }
            }
          });

          // Agregar o actualizar con unreadNotifs
          unreadNotifs.forEach(un => {
            const cid = Number(un.canalId);
            const canalInfo = canalesMapRef.current.get(cid);
            const esDirecto = un.canalTipo === 'directo';
            const fotoCanal = un.canalFoto || (!esDirecto ? canalInfo?.foto : null);
            if (!map.has(cid)) {
              map.set(cid, {
                canalId: cid,
                canalNombre: un.canalNombre,
                canalFoto: fotoCanal,
                otroUsuario: esDirecto ? {
                  foto_perfil: un.emisor_foto,
                  nombre: un.emisor_nombre,
                } : null,
                tipo: un.canalTipo,
                unreadCount: un.unread_count || 1,
                isOpen: true,
                isMinimized: true,
              });
            } else {
              const cur = map.get(cid);
              map.set(cid, {
                ...cur,
                canalFoto: fotoCanal || cur.canalFoto,
                unreadCount: cur.isMinimized ? (un.unread_count || cur.unreadCount) : cur.unreadCount
              });
            }
          });

          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error('Error al sincronizar notificaciones de canales:', err);
    }
  }, [currentView]);

  // Limpiar estado y recargar notificaciones cuando cambia el usuario (login / logout)
  useEffect(() => {
    if (user?.id) {
      setNotificaciones(getNotificacionesForUser(user.id));
      setFloatingChats([]);
      canalesMapRef.current.clear();
      try {
        localStorage.removeItem('isp_notificaciones_list');
        localStorage.removeItem('isp_notificaciones_center_v1');
      } catch {}
      sincronizarCanalesNoLeidos();
    } else {
      setNotificaciones([]);
      setFloatingChats([]);
      canalesMapRef.current.clear();
    }
  }, [user?.id, sincronizarCanalesNoLeidos]);

  const marcarLeida = useCallback((id) => {
    setNotificaciones(prev => {
      const notif = prev.find(n => n.id === id);
      const cid = notif?.canalId ? Number(notif.canalId) : null;
      if (cid) {
        chatInternoService.marcarLeido(cid).catch(console.error);
      }
      return prev.map(n => {
        if (n.id === id || (cid && Number(n.canalId) === cid)) {
          return { ...n, leida: true, unread_count: 0 };
        }
        return n;
      });
    });
  }, []);

  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones(prev => {
      prev.forEach(n => {
        if (!n.leida && n?.canalId) {
          chatInternoService.marcarLeido(n.canalId).catch(console.error);
        }
      });
      return prev.map(n => ({ ...n, leida: true, unread_count: 0 }));
    });
  }, []);

  const eliminarNotificacion = useCallback((id) => {
    setNotificaciones(prev => {
      const notif = prev.find(n => n.id === id);
      const cid = notif?.canalId ? Number(notif.canalId) : null;
      return prev.filter(n => {
        if (n.id === id) return false;
        if (cid && Number(n.canalId) === cid) return false;
        return true;
      });
    });
  }, []);

  const limpiarTodas = useCallback(() => {
    setNotificaciones([]);
  }, []);

  // Abrir o enfocar un chat flotante (expande su ventana y marca como leído en BD y UI)
  const abrirFloatingChat = useCallback((canalId, canalNombre, otroUsuario = null, tipo = 'directo', canalFoto = null) => {
    const cid = Number(canalId);
    const canalInfo = canalesMapRef.current.get(cid);
    const esDirecto = tipo === 'directo';
    const fotoFinal = canalFoto || (!esDirecto ? (canalInfo?.foto || null) : null);

    setFloatingChats(prev => {
      const idx = prev.findIndex(c => Number(c.canalId) === cid);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          isOpen: true,
          isMinimized: false,
          unreadCount: 0,
          canalNombre: canalNombre || copy[idx].canalNombre,
          canalFoto: fotoFinal || copy[idx].canalFoto,
          otroUsuario: esDirecto ? (otroUsuario || copy[idx].otroUsuario) : null,
          tipo: tipo || copy[idx].tipo,
        };
        return copy;
      }
      return [
        ...prev,
        {
          canalId: cid,
          canalNombre: canalNombre || (tipo === 'directo' ? 'Chat Directo' : `Canal #${cid}`),
          canalFoto: fotoFinal,
          otroUsuario: esDirecto ? otroUsuario : null,
          tipo,
          unreadCount: 0,
          isOpen: true,
          isMinimized: false,
        }
      ];
    });

    // Si es canal y aún no tenemos la foto, traerla en segundo plano
    if (!esDirecto && !fotoFinal) {
      chatInternoService.getCanales().then(canales => {
        const found = canales?.find(c => Number(c.id) === cid);
        if (found) {
          canalesMapRef.current.set(cid, found);
          if (found.foto) {
            setFloatingChats(prev => prev.map(fc => Number(fc.canalId) === cid ? { ...fc, canalFoto: found.foto } : fc));
          }
        }
      }).catch(() => {});
    }

    // Marcar como leído en backend y notificaciones porque el usuario lo abrió explícitamente
    chatInternoService.marcarLeido(cid).catch(() => {});
    setNotificaciones(prev =>
      prev.map(n => Number(n.canalId) === cid ? { ...n, leida: true, unread_count: 0 } : n)
    );
  }, []);

  const minimizarFloatingChat = useCallback((canalId) => {
    const cid = Number(canalId);
    setFloatingChats(prev =>
      prev.map(c => {
        if (Number(c.canalId) === cid) {
          const nuevoMin = !c.isMinimized;
          if (!nuevoMin) {
            // Se acaba de restaurar/abrir: marcar como leído y limpiar contador
            chatInternoService.marcarLeido(cid).catch(() => {});
            setNotificaciones(np =>
              np.map(n => Number(n.canalId) === cid ? { ...n, leida: true, unread_count: 0 } : n)
            );
            return { ...c, isMinimized: false, unreadCount: 0 };
          }
          return { ...c, isMinimized: true };
        }
        return c;
      })
    );
  }, []);

  const cerrarFloatingChat = useCallback((canalId) => {
    const cid = Number(canalId);
    setFloatingChats(prev => prev.filter(c => Number(c.canalId) !== cid));
  }, []);

  const limpiarUnreadFloatingChat = useCallback((canalId) => {
    const cid = Number(canalId);
    chatInternoService.marcarLeido(cid).catch(() => {});
    setFloatingChats(prev =>
      prev.map(c => Number(c.canalId) === cid ? { ...c, unreadCount: 0 } : c)
    );
    setNotificaciones(prev =>
      prev.map(n => Number(n.canalId) === cid ? { ...n, leida: true, unread_count: 0 } : n)
    );
  }, []);

  // Compatibilidad con invocaciones previas
  const abrirMiniChat = abrirFloatingChat;
  const minimizarMiniChat = useCallback(() => {
    if (floatingChats.length > 0) {
      minimizarFloatingChat(floatingChats[0].canalId);
    }
  }, [floatingChats, minimizarFloatingChat]);
  const cerrarMiniChat = useCallback(() => {
    if (floatingChats.length > 0) {
      cerrarFloatingChat(floatingChats[0].canalId);
    }
  }, [floatingChats, cerrarFloatingChat]);

  // Canal activo en pantalla en Chat Interno
  const canalInternoActivoRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      canalInternoActivoRef.current = e.detail?.canalId ? Number(e.detail.canalId) : null;
    };
    window.addEventListener('chat_interno:canal_activo_changed', handler);
    return () => window.removeEventListener('chat_interno:canal_activo_changed', handler);
  }, []);

  // Escuchar eventos en tiempo real para generar notificaciones y actualizar burbujas
  useEffect(() => {
    if (!socket || !user) return;

    const handleNotifMensaje = ({ canalId, canalNombre, canalTipo, canalFoto, mensaje, emisorId, miembros }) => {
      if (Number(emisorId) === Number(user.id)) return;
      if (Array.isArray(miembros) && !miembros.map(Number).includes(Number(user.id))) return;

      socket.emit('chat_interno:ack_entrega', { canalId: Number(canalId), mensajeId: mensaje?.id, emisorId: Number(emisorId) });

      const cid = Number(canalId);

      // Si el usuario está viendo actualmente este mismo canal dentro de Chat Interno, NO generar notificación no leída ni sonido externo
      if (currentView === 'chat-interno' && Number(canalInternoActivoRef.current) === cid) {
        return;
      }

      const canalInfo = canalesMapRef.current.get(cid);
      const esDirecto = canalTipo === 'directo' || (!canalTipo && (!canalNombre || canalNombre === 'directo' || !canalNombre.startsWith('#')));
      const titulo = esDirecto ? (mensaje.emisor_nombre || 'Chat Directo') : `#${(canalNombre || canalInfo?.nombre || 'canal').replace(/^#+/, '')}`;
      const fotoCanal = !esDirecto ? (canalFoto || canalInfo?.foto || null) : null;
      const textoMensaje = esDirecto
        ? (mensaje.tipo === 'imagen' ? '📷 Envió una imagen' : mensaje.tipo === 'archivo' ? `📎 Envió un archivo: ${mensaje.nombre_adjunto || ''}` : (mensaje.mensaje || 'Nuevo mensaje'))
        : `${mensaje.emisor_nombre}: ${mensaje.tipo === 'imagen' ? '📷 Imagen' : mensaje.tipo === 'archivo' ? '📎 Archivo' : (mensaje.mensaje || 'Mensaje')}`;

      agregarNotificacion({
        id: `canal_${cid}`,
        titulo,
        cuerpo: textoMensaje,
        emisor_nombre: titulo,
        emisor_foto: esDirecto ? mensaje.emisor_foto : null,
        canalFoto: fotoCanal,
        tipo: 'mensaje',
        canalTipo: esDirecto ? 'directo' : 'canal',
        canalId: cid,
        canalNombre: titulo,
        unread_count: 1,
        url_adjunto: mensaje.url_adjunto,
        tipoAdjunto: mensaje.tipo,
      });

      // Si es un canal grupal y aún no tenemos la foto en memoria, consultarla
      if (!esDirecto && !fotoCanal) {
        chatInternoService.getCanales().then(canales => {
          const found = canales?.find(c => Number(c.id) === cid);
          if (found) {
            canalesMapRef.current.set(cid, found);
            if (found.foto) {
              setFloatingChats(prev => prev.map(fc => Number(fc.canalId) === cid ? { ...fc, canalFoto: found.foto } : fc));
            }
          }
        }).catch(() => {});
      }

      // Si el usuario está fuera de chat-interno, actualizar o agregar la burbuja flotante
      // IMPORTANTE: Aparece en estado MINIMIZADO y con globo contador, SIN auto-marcar como leído en BD
      if (currentView !== 'chat-interno') {
        setFloatingChats(prev => {
          const idx = prev.findIndex(fc => Number(fc.canalId) === cid);
          const otroData = esDirecto ? {
            id: emisorId,
            nombre: mensaje.emisor_nombre,
            foto_perfil: mensaje.emisor_foto,
            rol: mensaje.emisor_rol,
          } : null;

          if (idx !== -1) {
            const chatExistente = prev[idx];
            const estaAbiertoYActivo = chatExistente.isOpen && !chatExistente.isMinimized;
            const updated = {
              ...chatExistente,
              canalNombre: titulo,
              canalFoto: fotoCanal || chatExistente.canalFoto,
              otroUsuario: otroData || (esDirecto ? chatExistente.otroUsuario : null),
              unreadCount: estaAbiertoYActivo ? 0 : (chatExistente.unreadCount || 0) + 1,
              tipo: esDirecto ? 'directo' : 'canal',
            };
            const copia = [...prev];
            copia[idx] = updated;
            return copia;
          } else {
            const nuevoChat = {
              canalId: cid,
              canalNombre: titulo,
              canalFoto: fotoCanal,
              otroUsuario: otroData,
              tipo: esDirecto ? 'directo' : 'canal',
              unreadCount: 1,
              isOpen: true,
              isMinimized: true,
            };
            return [...prev, nuevoChat];
          }
        });
      }
    };

    const handleFuisteRemovido = ({ canalId, canalNombre, agenteIdRemovido, removidoPorNombre }) => {
      if (Number(agenteIdRemovido) === Number(user.id)) {
        const cid = Number(canalId);
        setFloatingChats(prev => prev.filter(c => Number(c.canalId) !== cid));
        canalesMapRef.current.delete(cid);
        agregarNotificacion({
          titulo: `#${canalNombre}`,
          cuerpo: `Has sido removido de este canal por ${removidoPorNombre}.`,
          emisor_nombre: `#${canalNombre}`,
          tipo: 'miembro_removido',
          canalTipo: 'canal',
          canalId: cid,
          canalNombre: `#${canalNombre}`,
        });
      }
    };

    const handleCanalCerrado = ({ canalId, nombre }) => {
      const cid = Number(canalId);
      setFloatingChats(prev => prev.filter(c => Number(c.canalId) !== cid));
      canalesMapRef.current.delete(cid);
      agregarNotificacion({
        titulo: `#${nombre}`,
        cuerpo: `Este canal fue cerrado y eliminado por un administrador.`,
        emisor_nombre: `#${nombre}`,
        tipo: 'canal_cerrado',
        canalTipo: 'canal',
        canalId: cid,
        canalNombre: `#${nombre}`,
      });
    };

    const handleMensajesLeidos = ({ canalId, agenteId }) => {
      if (Number(agenteId) === Number(user?.id)) {
        const cid = Number(canalId);
        setNotificaciones(prev =>
          prev.map(n => Number(n.canalId) === cid ? { ...n, leida: true, unread_count: 0 } : n)
        );
        setFloatingChats(prev =>
          prev
            .map(c => Number(c.canalId) === cid ? { ...c, unreadCount: 0 } : c)
            .filter(c => Number(c.canalId) !== cid || (c.isOpen && !c.isMinimized))
        );
      }
    };

    socket.on('chat_interno:notificacion_mensaje', handleNotifMensaje);
    socket.on('chat_interno:fuiste_removido', handleFuisteRemovido);
    socket.on('chat_interno:canal_eliminado', handleCanalCerrado);
    socket.on('chat_interno:mensajes_leidos', handleMensajesLeidos);

    return () => {
      socket.off('chat_interno:notificacion_mensaje', handleNotifMensaje);
      socket.off('chat_interno:fuiste_removido', handleFuisteRemovido);
      socket.off('chat_interno:canal_eliminado', handleCanalCerrado);
      socket.off('chat_interno:mensajes_leidos', handleMensajesLeidos);
    };
  }, [socket, user, currentView, agregarNotificacion]);

  // Contar total de no leídos únicos (canales + eventos)
  const unreadCount = (() => {
    const seenCanales = new Set();
    return notificaciones.filter(n => {
      if (n.leida) return false;
      if (n.canalId) {
        const cid = Number(n.canalId);
        if (seenCanales.has(cid)) return false;
        seenCanales.add(cid);
      }
      return true;
    }).length;
  })();

  // Contar total de mensajes no leídos de canales/chats directos internos
  const unreadChatInterno = (() => {
    const seen = new Set();
    return notificaciones
      .filter(n => !n.leida && n.canalId)
      .reduce((acc, n) => {
        const cid = Number(n.canalId);
        if (seen.has(cid)) return acc;
        seen.add(cid);
        return acc + (Number(n.unread_count) || 1);
      }, 0);
  })();

  const miniChat = floatingChats.find(c => c.isOpen && !c.isMinimized) || floatingChats[0] || {
    isOpen: false,
    isMinimized: false,
    canalId: null,
    canalNombre: '',
    otroUsuario: null,
    tipo: 'directo',
  };

  return {
    notificaciones,
    unreadCount,
    unreadChatInterno,
    marcarLeida,
    marcarTodasLeidas,
    eliminarNotificacion,
    limpiarTodas,
    floatingChats,
    abrirFloatingChat,
    minimizarFloatingChat,
    cerrarFloatingChat,
    limpiarUnreadFloatingChat,
    miniChat,
    abrirMiniChat,
    minimizarMiniChat,
    cerrarMiniChat,
    sincronizarCanalesNoLeidos,
  };
}
