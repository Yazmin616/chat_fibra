/**
 * @file useNotificacionesCenter.js
 * @description Hook global para gestionar la bandeja de notificaciones estilo Facebook
 * y la ventana flotante de Messenger sincronizado con los mensajes no leídos del CRM.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatInternoService } from '../services/chatInterno.service';

const NOTIFICACIONES_STORAGE_KEY = 'isp_notificaciones_list';
const NOTIF_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

export function useNotificacionesCenter({ socket, user, currentView, setCurrentView }) {
  const [notificaciones, setNotificaciones] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTIFICACIONES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  

  const [miniChat, setMiniChat] = useState({
    isOpen: false,
    isMinimized: false,
    canalId: null,
    canalNombre: '',
    otroUsuario: null,
    tipo: 'directo',
  });

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Guardar en localStorage por usuario
  useEffect(() => {
    if (!user?.id) return;
    try {
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
    const nueva = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tiempo: new Date().toISOString(),
      leida: false,
      ...notif,
    };

    setNotificaciones(prev => [nueva, ...prev.filter(n => !(n.canalId === notif.canalId && n.tipo === notif.tipo))].slice(0, 50));
    reproducirSonido();

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(nueva.titulo, { body: nueva.cuerpo, icon: '/favicon.ico' });
      } catch {}
    }

    return nueva;
  }, [reproducirSonido]);

    // Cargar canales iniciales para sincronizar mensajes no leídos
  const sincronizarCanalesNoLeidos = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const data = await chatInternoService.getCanales();
      const unreadMap = {};
      const unreadNotifs = [];

      (data || []).forEach(c => {
        const count = Number(c.unread_count || 0);
        if (count > 0) {
          unreadMap[c.id] = count;
          const esDirecto = c.tipo === 'directo';
          const titulo = esDirecto ? (c.otro_participante?.nombre || 'Chat Directo') : `#${c.nombre}`;
          const cuerpo = esDirecto
            ? (c.ultimo_mensaje?.mensaje || 'Mensajes pendientes en esta conversación')
            : (c.ultimo_mensaje?.emisor_nombre
                ? `${c.ultimo_mensaje.emisor_nombre}: ${c.ultimo_mensaje.mensaje || 'Envió un adjunto'}`
                : (c.ultimo_mensaje?.mensaje || 'Mensajes pendientes en el canal'));

          unreadNotifs.push({
            id: `unread_canal_${c.id}`,
            titulo,
            cuerpo,
            emisor_nombre: titulo,
            emisor_foto: esDirecto ? c.otro_participante?.foto_perfil : null,
            tipo: 'mensaje',
            canalTipo: c.tipo,
            canalId: c.id,
            canalNombre: titulo,
            unread_count: count,
            tiempo: c.ultimo_mensaje?.created_at || c.created_at || new Date().toISOString(),
            leida: false,
          });
        }
      });

      

      if (unreadNotifs.length > 0) {
        setNotificaciones(prev => {
          const idsMap = new Set(unreadNotifs.map(n => n.id));
          const filteredPrev = prev.filter(p => !idsMap.has(p.id));
          return [...unreadNotifs, ...filteredPrev].slice(0, 50);
        });
      }
    } catch (err) {
      console.error('Error al sincronizar notificaciones de canales:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      sincronizarCanalesNoLeidos();
    }
  }, [user?.id, sincronizarCanalesNoLeidos]);

  const marcarLeida = useCallback((id) => {
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }, []);

  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    
  }, []);

  const eliminarNotificacion = useCallback((id) => {
    setNotificaciones(prev => prev.filter(n => n.id !== id));
  }, []);

  const limpiarTodas = useCallback(() => {
    setNotificaciones([]);
    
  }, []);

  // Abrir mini ventana flotante estilo Messenger
  const abrirMiniChat = useCallback((canalId, canalNombre, otroUsuario = null, tipo = 'directo') => {
    setMiniChat({
      isOpen: true,
      isMinimized: false,
      canalId,
      canalNombre,
      otroUsuario,
      tipo,
    });
  }, []);

  const minimizarMiniChat = useCallback(() => {
    setMiniChat(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const cerrarMiniChat = useCallback(() => {
    setMiniChat({
      isOpen: false,
      isMinimized: false,
      canalId: null,
      canalNombre: '',
      otroUsuario: null,
      tipo: 'directo',
    });
  }, []);

  // Escuchar eventos en tiempo real para generar notificaciones
  useEffect(() => {
    if (!socket || !user) return;

    const handleNotifMensaje = ({ canalId, canalNombre, canalTipo, mensaje, emisorId, miembros }) => {
      if (Number(emisorId) === Number(user.id)) return;
      if (Array.isArray(miembros) && !miembros.map(Number).includes(Number(user.id))) return;

      const esDirecto = canalTipo === 'directo';
      const titulo = esDirecto ? (mensaje.emisor_nombre || 'Chat Directo') : `#${canalNombre || 'canal'}`;
      const textoMensaje = esDirecto
        ? (mensaje.tipo === 'imagen' ? '📷 Envió una imagen' : mensaje.tipo === 'archivo' ? `📎 Envió un archivo: ${mensaje.nombre_adjunto || ''}` : (mensaje.mensaje || 'Nuevo mensaje'))
        : `${mensaje.emisor_nombre}: ${mensaje.tipo === 'imagen' ? '📷 Imagen' : mensaje.tipo === 'archivo' ? '📎 Archivo' : (mensaje.mensaje || 'Mensaje')}`;

      
      agregarNotificacion({
        titulo,
        cuerpo: textoMensaje,
        emisor_nombre: titulo,
        emisor_foto: esDirecto ? mensaje.emisor_foto : null,
        tipo: 'mensaje',
        canalTipo: esDirecto ? 'directo' : 'canal',
        canalId,
        canalNombre: titulo,
        unread_count: 1,
      });

      if (currentView !== 'chat-interno' && !miniChat.isOpen) {
        abrirMiniChat(canalId, titulo, {
          id: emisorId,
          nombre: mensaje.emisor_nombre,
          foto_perfil: mensaje.emisor_foto,
          rol: mensaje.emisor_rol,
        }, esDirecto ? 'directo' : 'canal');
      }
    };

    const handleFuisteRemovido = ({ canalId, canalNombre, agenteIdRemovido, removidoPorNombre }) => {
      if (Number(agenteIdRemovido) === Number(user.id)) {
        agregarNotificacion({
          titulo: `#${canalNombre}`,
          cuerpo: `Has sido removido de este canal por ${removidoPorNombre}.`,
          emisor_nombre: `#${canalNombre}`,
          tipo: 'miembro_removido',
          canalTipo: 'canal',
          canalId,
          canalNombre: `#${canalNombre}`,
        });
      }
    };

    const handleCanalCerrado = ({ canalId, nombre }) => {
      agregarNotificacion({
        titulo: `#${nombre}`,
        cuerpo: `Este canal fue cerrado y eliminado por un administrador.`,
        emisor_nombre: `#${nombre}`,
        tipo: 'canal_cerrado',
        canalTipo: 'canal',
        canalId,
        canalNombre: `#${nombre}`,
      });
    };

    const handleMensajesLeidos = ({ canalId, agenteId }) => {
      if (Number(agenteId) === Number(user.id)) {
                setNotificaciones(prev => prev.map(n => n.canalId === canalId ? { ...n, leida: true } : n));
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
  }, [socket, user, currentView, miniChat.isOpen, agregarNotificacion, abrirMiniChat]);

  // Contar total de no leídos (canales + eventos)
  const unreadCount = notificaciones.filter(n => !n.leida).length;

  return {
    notificaciones,
    unreadCount,
    marcarLeida,
    marcarTodasLeidas,
    eliminarNotificacion,
    limpiarTodas,
    miniChat,
    abrirMiniChat,
    minimizarMiniChat,
    cerrarMiniChat,
    sincronizarCanalesNoLeidos,
  };
}
