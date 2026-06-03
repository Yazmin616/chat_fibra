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
  const typingTimerRef    = useRef(null);
  const disconnectedAtRef = useRef(null);
  const notifyRef         = useRef(notify);   // evita stale closure — notify cambia cada render
  const userRef           = useRef(user);
  const empresaIdRef      = useRef(empresaId);

  // Mantener refs sincronizados con los props más recientes
  useEffect(() => { notifyRef.current   = notify;    }, [notify]);
  useEffect(() => { userRef.current     = user;      }, [user]);
  useEffect(() => { empresaIdRef.current = empresaId; }, [empresaId]);

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
      const convId      = Number(data.conversacion_id);
      const mismoChatId = convId === Number(convActiva?.id);

      if (data.remitente === 'user') {
        notifyRef.current('Nuevo mensaje', data.mensaje);
      }

      // Actualizar la lista: preview, timestamp, badge de no-leídos y mover al tope.
      // Si idx === -1 (conversación nueva) se dispara un refetch desde server
      // para incluirla — no se devuelve prev sin más porque eso es mismo-referencia
      // y React no re-renderiza, dejando la UI congelada.
      setConversaciones(prev => {
        const idx = prev.findIndex(c => Number(c.id) === convId);

        if (idx === -1) {
          // Conversación nueva: no está en la lista todavía.
          // conversacion_actualizada (emitido desde backend) disparará el refetch completo.
          // Devolvemos un NUEVO array vacío de diferente referencia para forzar el render
          // y que el estado quede preparado para recibir el refetch.
          return prev.length === 0 ? [] : prev;
        }

        const conv    = prev[idx];
        const updated = {
          ...conv,
          ultimo_mensaje:       data.mensaje,
          ultimo_remitente:     data.remitente,
          fecha_ultimo_mensaje: data.fecha || new Date().toISOString(),
          no_leidos: (data.remitente === 'user' && !mismoChatId)
            ? String(parseInt(conv.no_leidos || 0) + 1)
            : conv.no_leidos,
        };

        // Quitar de posición actual e insertar al principio
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });

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
    // El payload trae { id, estado, es_humano, empresa_id }.
    // 1. Actualización inmediata en memoria (sin esperar el fetch del server)
    //    → el badge de estado y el panel DATOS DEL FLUJO cambian al instante.
    // 2. Refetch completo para asegurar consistencia total del servidor.
    // 3. Después del refetch, sincronizar conversacionActiva con el estado fresco.
    const handleActualizacion = (payload) => {
      const convId = payload?.id ? Number(payload.id) : null;

      // 1. Actualizar en memoria el estado de la conversación afectada
      if (convId && payload?.estado) {
        setConversaciones(prev => prev.map(c =>
          Number(c.id) === convId
            ? { ...c, estado: payload.estado, es_humano: payload.es_humano ?? c.es_humano }
            : c
        ));

        // Si es la conversación abierta, actualizar también conversacionActiva
        const convActiva = convActivaRef.current;
        if (convActiva && Number(convActiva.id) === convId) {
          setConversacionActiva(prev =>
            prev ? { ...prev, estado: payload.estado, es_humano: payload.es_humano ?? prev.es_humano } : prev
          );
        }
      }

      // 2. Refetch completo + sincronizar conversacionActiva con datos del server
      const uid = userRef.current?.id;
      if (uid) {
        apiService.getConversaciones('todas', uid)
          .then(fresh => {
            if (!Array.isArray(fresh)) return;
            setConversaciones(fresh);

            // 3. Actualizar conversacionActiva con los datos frescos del server
            const convActiva = convActivaRef.current;
            if (convActiva) {
              const fresca = fresh.find(c => Number(c.id) === Number(convActiva.id));
              if (fresca) setConversacionActiva(fresca);
            }
          })
          .catch(() => {});
      }

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
      setMensajes(prev => prev.map(m => {
        if (m.id !== data.mensaje_id) return m;
        const update = { ...m, estado: data.estado };
        if (data.url_media) update.url_media = data.url_media;
        return update;
      }));
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

    // ─── resync tras reconexión ──────────────────────────────────────
    // Al reconectar se re-solicitan conversaciones y mensajes del chat abierto
    // para recuperar eventos perdidos durante la desconexión.
    // La dedup de mensajes usa mensaje_id (ya presente en el payload desde el backend).
    const handleDisconnect = () => {
      disconnectedAtRef.current = Date.now();
    };

    const handleConnect = () => {
      if (!disconnectedAtRef.current) return; // conexión inicial, no una reconexión
      disconnectedAtRef.current = null;

      // Usar refs para tener siempre el valor más reciente (no stale closure)
      const uid = userRef.current?.id;
      if (!uid) return;

      apiService.getConversaciones(empresaIdRef.current || 'todas', uid)
        .then(data => setConversaciones(Array.isArray(data) ? data : []))
        .catch(() => {});

      const conv = convActivaRef.current;
      if (conv) {
        apiService.getMensajes(conv.usuario_id, uid, conv.id)
          .then(msgs => { if (Array.isArray(msgs)) setMensajes(msgs); })
          .catch(() => {});
      }
    };

    socket.on('nuevo_mensaje',            handleNuevoMensaje);
    socket.on('conversacion_leida',       handleLectura);
    socket.on('conversacion_actualizada', handleActualizacion);
    socket.on('conversacion_eliminada',   handleEliminacion);
    socket.on('agentes_actualizados',     handleAgentesActualizados);
    socket.on('mensaje_estado',           handleMensajeEstado);
    socket.on('mensajes_leidos',          handleMensajesLeidos);
    socket.on('cliente_escribiendo',      handleClienteEscribiendo);
    socket.on('disconnect',               handleDisconnect);
    socket.on('connect',                  handleConnect);

    return () => {
      socket.off('nuevo_mensaje',            handleNuevoMensaje);
      socket.off('conversacion_leida',       handleLectura);
      socket.off('conversacion_actualizada', handleActualizacion);
      socket.off('conversacion_eliminada',   handleEliminacion);
      socket.off('agentes_actualizados',     handleAgentesActualizados);
      socket.off('mensaje_estado',           handleMensajeEstado);
      socket.off('mensajes_leidos',          handleMensajesLeidos);
      socket.off('cliente_escribiendo',      handleClienteEscribiendo);
      socket.off('disconnect',               handleDisconnect);
      socket.off('connect',                  handleConnect);
      clearTimeout(typingTimerRef.current);
    };
  // Solo se monta/desmonta cuando el socket o el usuario cambian.
  // conversacionActiva se lee siempre fresco a través de convActivaRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user]);
}
