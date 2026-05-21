import { useEffect, useRef } from 'react';
import { apiService } from '../services/api';

export function useSocket({
  socket,
  user,
  empresaId,
  conversacionActiva,
  setConversaciones,
  setMensajes,
  setConversacionActiva,
  setClienteEscribiendo,
  notify
}) {
  const typingTimerRef = useRef(null);

  // Ref que siempre apunta a la conversación abierta sin necesidad de recrear
  // los handlers. Esto evita el ciclo teardown/setup cada vez que el usuario
  // abre un chat diferente.
  const convActivaRef = useRef(conversacionActiva);
  useEffect(() => {
    convActivaRef.current = conversacionActiva;
  }, [conversacionActiva]);

  useEffect(() => {
    if (!user) return;

    // ─── nuevo_mensaje ───────────────────────────────────────────────
    // IMPORTANTE: el matching siempre se hace por conversacion_id, nunca por
    // usuario_id. Un mismo usuario puede tener conversaciones activas en distintas
    // empresas al mismo tiempo; mezclarlas sería incorrecto.
    const handleNuevoMensaje = (data) => {
      const convActiva  = convActivaRef.current;
      const mismoChatId = Number(data.conversacion_id) === Number(convActiva?.id);

      if (data.remitente === 'user') {
        notify('Nuevo mensaje', data.mensaje);
      }

      // Actualizar contador de no-leídos solo en la conversación exacta
      setConversaciones(prev => prev.map(c => {
        if (Number(c.id) !== Number(data.conversacion_id)) return c;
        if (data.remitente !== 'user') return c;
        // Si ese chat está abierto, no incrementar el contador
        if (mismoChatId) return c;
        return { ...c, no_leidos: String(parseInt(c.no_leidos || 0) + 1) };
      }));

      // Añadir el mensaje a la ventana solo si es la conversación abierta
      if (!convActiva || !mismoChatId) return;

      const newMsg = {
        id:         data.mensaje_id,
        remitente:  data.remitente,
        texto:      data.mensaje,
        tipo:       data.tipo      || 'text',
        url_media:  data.url_media || null,
        estado:     data.estado    || (data.remitente === 'user' ? undefined : 'enviado'),
        created_at: data.fecha     || new Date(),
      };

      clearTimeout(typingTimerRef.current);
      setClienteEscribiendo(false);
      setMensajes(prev => {
        if (newMsg.id && prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      apiService.marcarLeido(convActivaRef.current?.id);
    };

    // ─── conversacion_leida ──────────────────────────────────────────
    // Solo resetear el contador de la conversación exacta, no de todas las
    // del mismo usuario (podrían pertenecer a otra empresa).
    const handleLectura = (data) => {
      setConversaciones(prev => prev.map(c => {
        if (Number(c.id) !== Number(data.conversacion_id)) return c;
        return { ...c, no_leidos: '0' };
      }));
    };

    // ─── conversacion_actualizada ────────────────────────────────────
    const handleActualizacion = () => {
      apiService.getConversaciones('todas', user.id)
        .then(data => setConversaciones(Array.isArray(data) ? data : []));
      window.dispatchEvent(new CustomEvent('contactos:actualizar'));
    };

    // ─── conversacion_eliminada ──────────────────────────────────────
    // El borrado está acotado por empresa: solo se eliminan las conversaciones
    // de la empresa indicada en el evento. Si el chat activo pertenece a otra
    // empresa del mismo usuario, no se cierra.
    const handleEliminacion = (data) => {
      // Quitar de la lista solo las conversaciones de la empresa eliminada
      setConversaciones(prev => prev.filter(c =>
        !(Number(c.usuario_id) === Number(data.usuarioId) && c.empresa_id === data.empresaId)
      ));
      window.dispatchEvent(new CustomEvent('contactos:actualizar'));

      // Cerrar el panel solo si el chat activo era de esa misma empresa
      const convActiva = convActivaRef.current;
      if (convActiva) {
        const esMismaConv    = Number(data.id) === Number(convActiva.id);
        const esMismaEmpresa = convActiva.empresa_id === data.empresaId;
        const esMismoUsuario = Number(data.usuarioId) === Number(convActiva.usuario_id);
        if (esMismaConv || (esMismoUsuario && esMismaEmpresa)) {
          setConversacionActiva(null);
          setMensajes([]);
        }
      }
    };

    // ─── agentes_actualizados ────────────────────────────────────────
    const handleAgentesActualizados = () => {
      window.dispatchEvent(new CustomEvent('agentes:actualizar'));
    };

    // ─── mensaje_estado ──────────────────────────────────────────────
    const handleMensajeEstado = (data) => {
      setMensajes(prev => prev.map(m =>
        m.id === data.mensaje_id ? { ...m, estado: data.estado } : m
      ));
    };

    // ─── mensajes_leidos ─────────────────────────────────────────────
    const handleMensajesLeidos = (data) => {
      const idSet = new Set(data.ids);
      setMensajes(prev => prev.map(m =>
        idSet.has(m.id) ? { ...m, estado: 'leido' } : m
      ));
    };

    // ─── cliente_escribiendo ─────────────────────────────────────────
    const handleClienteEscribiendo = (data) => {
      if (!setClienteEscribiendo) return;
      const convActiva = convActivaRef.current;
      if (!convActiva) return;
      if (Number(data.conversacion_id) !== Number(convActiva.id)) return;
      setClienteEscribiendo(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setClienteEscribiendo(false), 4000);
    };

    socket.on('nuevo_mensaje',            handleNuevoMensaje);
    socket.on('conversacion_leida',       handleLectura);
    socket.on('conversacion_actualizada', handleActualizacion);
    socket.on('conversacion_eliminada',   handleEliminacion);
    socket.on('agentes_actualizados',     handleAgentesActualizados);
    socket.on('mensaje_estado',           handleMensajeEstado);
    socket.on('mensajes_leidos',          handleMensajesLeidos);
    socket.on('cliente_escribiendo',      handleClienteEscribiendo);

    return () => {
      socket.off('nuevo_mensaje',            handleNuevoMensaje);
      socket.off('conversacion_leida',       handleLectura);
      socket.off('conversacion_actualizada', handleActualizacion);
      socket.off('conversacion_eliminada',   handleEliminacion);
      socket.off('agentes_actualizados',     handleAgentesActualizados);
      socket.off('mensaje_estado',           handleMensajeEstado);
      socket.off('mensajes_leidos',          handleMensajesLeidos);
      socket.off('cliente_escribiendo',      handleClienteEscribiendo);
      clearTimeout(typingTimerRef.current);
    };
  // Solo se monta/desmonta cuando el socket o el usuario cambian.
  // conversacionActiva se lee siempre fresco a través de convActivaRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user]);
}
