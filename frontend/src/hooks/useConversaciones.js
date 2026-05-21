/**
 * @file useConversaciones.js
 * @description Hook de React que centraliza todo el estado y las acciones
 * relacionadas con conversaciones y mensajes en el panel CRM.
 *
 * Diseño multi-empresa:
 *   - Siempre carga TODAS las conversaciones de todas las empresas en memoria.
 *   - El selector de empresa en el TopBar actúa como filtro visual client-side,
 *     no dispara nuevas peticiones al backend.
 *   - Esto garantiza que los contadores de no-leídos y las notificaciones funcionen
 *     sin importar qué empresa esté filtrada en pantalla.
 *
 * Gestiona:
 *   - Lista completa de conversaciones del agente (todas las empresas).
 *   - Conversación activa (la que está abierta en el panel derecho).
 *   - Mensajes de la conversación activa.
 *   - Configuraciones del sistema (tiempo_inactividad, etc.) por empresa activa.
 *   - Acciones: cargar, cargarMensajes, enviarMensaje, cerrarChat, eliminarChat.
 *
 * Uso:
 *   const { conversaciones, conversacionActiva, mensajes, ... } = useConversaciones(user, empresaId);
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiService } from '../services/api';

/**
 * @param {{ id, nombre, rol, area } | null} user       - Agente autenticado.
 * @param {string}                           empresaId  - Empresa activa para configuración y filtro visual.
 * @returns {{
 *   conversaciones:        object[],
 *   setConversaciones:     Function,
 *   conversacionActiva:    object | null,
 *   setConversacionActiva: Function,
 *   mensajes:              object[],
 *   setMensajes:           Function,
 *   config:                object,
 *   setConfig:             Function,
 *   cargar:                () => Promise<void>,
 *   cargarMensajes:        (usuarioId: number, conversacionId: number) => Promise<void>,
 *   enviarMensaje:         (texto: string) => Promise<void>,
 *   cerrarChat:            (id: number, motivo: string) => Promise<void>,
 *   eliminarChat:          (id: number) => Promise<void>
 * }}
 */
export function useConversaciones(user, empresaId) {
  const [conversaciones,       setConversaciones]       = useState([]);
  const [conversacionActiva,   setConversacionActiva]   = useState(null);
  const [mensajes,             setMensajes]             = useState([]);
  const [config,               setConfig]               = useState({ tiempo_inactividad: 10 });
  const requestIdRef = useRef(0);

  /**
   * Carga TODAS las conversaciones (todas las empresas) y la configuración
   * de la empresa seleccionada actualmente.
   *
   * Se usa 'todas' como empresa_id para el fetch de conversaciones para
   * garantizar visibilidad completa multi-empresa desde un único login.
   */
  const cargar = useCallback(async () => {
    if (!user) return;
    try {
      const convs = await apiService.getConversaciones('todas', user.id);
      setConversaciones(Array.isArray(convs) ? convs : []);
    } catch (err) {
      console.error('[useConversaciones] cargar conversaciones:', err);
    }
    if (user.rol === 'admin') {
      try {
        const confs = await apiService.getConfigs(empresaId);
        setConfig(confs && typeof confs === 'object' && !Array.isArray(confs) ? confs : { tiempo_inactividad: 10 });
      } catch (err) {
        console.error('[useConversaciones] cargar config:', err);
      }
    }
  }, [user, empresaId]);

  // Recargar configuración cuando cambia la empresa seleccionada.
  // Las conversaciones NO se recargan — ya están todas en memoria.
  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Carga el historial de mensajes del usuario/conversación seleccionados
   * y marca la conversación como leída.
   *
   * @param {number} usuarioId       - PK del usuario.
   * @param {number} conversacionId  - PK de la conversación (null para Admin con vista unificada).
   */
  const cargarMensajes = useCallback(async (usuarioId, conversacionId) => {
    if (!usuarioId || !user) return;
    const myId = ++requestIdRef.current;
    setMensajes([]);

    try {
      const msgs = await apiService.getMensajes(usuarioId, user.id, conversacionId);
      if (myId !== requestIdRef.current) return; // llegó tarde: ya se cambió de conversación
      setMensajes(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      if (myId !== requestIdRef.current) return;
      console.error('[cargarMensajes]', err);
      setMensajes([]);
    }

    if (conversacionId) {
      // Fire-and-forget: no bloquea ni recarga toda la lista
      apiService.marcarLeido(conversacionId).catch(() => {});
      setConversaciones(prev =>
        prev.map(c => c.id === conversacionId ? { ...c, no_leidos: 0 } : c)
      );
    }
  }, [user]);

  /**
   * Envía el mensaje del agente al cliente a través del backend.
   * @param {string} texto - Texto a enviar.
   */
  const enviarMensaje = useCallback(async (texto) => {
    if (!texto || !conversacionActiva) return;
    await apiService.responder(
      conversacionActiva.id,
      conversacionActiva.external_id,
      texto,
      user.id
    );
  }, [conversacionActiva, user]);

  /**
   * Cierra el chat del agente: llama a liberar() en el backend y recarga la lista.
   * @param {number} id     - PK de la conversación.
   * @param {string} motivo - Motivo del cierre.
   */
  const cerrarChat = useCallback(async (id, motivo, solucion) => {
    await apiService.cerrarChat(id, motivo, user.nombre, solucion);
    await cargar();
  }, [user, cargar]);

  /**
   * Borrado total (GDPR): elimina todos los datos del usuario y recarga la lista.
   * Limpia la conversación activa si era la que se eliminó.
   * @param {number} id - PK de cualquier conversación del usuario a eliminar.
   */
  const eliminarChat = useCallback(async (id) => {
    await apiService.eliminarChat(id);
    setConversacionActiva(null);
    setMensajes([]);
    await cargar();
  }, [cargar]);

  return {
    conversaciones,    setConversaciones,
    conversacionActiva, setConversacionActiva,
    mensajes,          setMensajes,
    config,            setConfig,
    cargar,
    cargarMensajes,
    enviarMensaje,
    cerrarChat,
    eliminarChat
  };
}
