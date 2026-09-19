/**
 * @file useAgentes.js
 * @description Hook de React que encapsula la gestión de agentes del CRM.
 *
 * Responsabilidades:
 *   - Cargar la lista de agentes desde el backend.
 *   - Crear un nuevo agente.
 *   - Eliminar un agente existente.
 *
 * Uso:
 *   const { agentes, loading, crearAgente, eliminarAgente } = useAgentes();
 */

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

/**
 * @returns {{
 *   agentes:        object[],
 *   loading:        boolean,
 *   crearAgente:    (formData: object) => Promise<void>,
 *   eliminarAgente: (id: number) => Promise<void>
 * }}
 */
export function useAgentes() {
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await apiService.getAgentes();
      setAgentes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[useAgentes] cargar:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(false); }, [cargar]);

  // Polling silencioso en vivo cada 5 segundos para mantener estados y tiempos sincronizados
  useEffect(() => {
    const interval = setInterval(() => {
      cargar(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [cargar]);

  // Recarga la lista cuando el backend notifica cambios generales
  useEffect(() => {
    const handler = () => cargar(true);
    window.addEventListener('agentes:actualizar', handler);
    return () => window.removeEventListener('agentes:actualizar', handler);
  }, [cargar]);

  // Actualiza presencia en vivo via Polling global de la app
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail) return;
      const onlineIds = new Set(e.detail.map(Number));
      setAgentes(prev => prev.map(a => {
        const isOnline = onlineIds.has(Number(a.id));
        return {
          ...a,
          esta_online: isOnline,
          last_seen: isOnline ? new Date().toISOString() : a.last_seen
        };
      }));
    };
    window.addEventListener('agentes:presencia_polling', handler);
    return () => window.removeEventListener('agentes:presencia_polling', handler);
  }, []);

  // Sincronización instantánea cuando el usuario actual cambia su estado desde el TopBar
  useEffect(() => {
    const handlePresenciaLocal = (e) => {
      if (!e.detail || !e.detail.id) return;
      const { id, estado_presencia } = e.detail;
      setAgentes(prev => prev.map(a =>
        Number(a.id) === Number(id)
          ? {
              ...a,
              esta_online: true,
              estado_presencia,
              last_seen: new Date().toISOString()
            }
          : a
      ));
    };
    window.addEventListener('sistema:presencia_cambiada', handlePresenciaLocal);
    return () => window.removeEventListener('sistema:presencia_cambiada', handlePresenciaLocal);
  }, []);

  // Escuchar eventos en tiempo real transmitidos por Socket
  useEffect(() => {
    const handleSocketOnline = (e) => {
      if (!e.detail || !e.detail.id) return;
      const { id, estado_presencia, mensaje_presencia } = e.detail;
      setAgentes(prev => prev.map(a =>
        Number(a.id) === Number(id)
          ? {
              ...a,
              esta_online: true,
              estado_presencia: estado_presencia || a.estado_presencia || 'disponible',
              mensaje_presencia: mensaje_presencia !== undefined ? mensaje_presencia : a.mensaje_presencia,
              last_seen: new Date().toISOString()
            }
          : a
      ));
    };

    const handleSocketOffline = (e) => {
      if (!e.detail || !e.detail.id) return;
      const { id } = e.detail;
      setAgentes(prev => prev.map(a =>
        Number(a.id) === Number(id)
          ? { ...a, esta_online: false, last_seen: new Date().toISOString() }
          : a
      ));
    };

    const handleSocketPresencia = (e) => {
      if (!e.detail || !e.detail.id) return;
      const { id, estado_presencia, mensaje_presencia } = e.detail;
      setAgentes(prev => prev.map(a =>
        Number(a.id) === Number(id)
          ? {
              ...a,
              esta_online: true,
              estado_presencia: estado_presencia || a.estado_presencia,
              mensaje_presencia: mensaje_presencia !== undefined ? mensaje_presencia : a.mensaje_presencia,
              last_seen: new Date().toISOString()
            }
          : a
      ));
    };

    window.addEventListener('agente:socket_online', handleSocketOnline);
    window.addEventListener('agente:socket_offline', handleSocketOffline);
    window.addEventListener('agente:socket_presencia', handleSocketPresencia);

    return () => {
      window.removeEventListener('agente:socket_online', handleSocketOnline);
      window.removeEventListener('agente:socket_offline', handleSocketOffline);
      window.removeEventListener('agente:socket_presencia', handleSocketPresencia);
    };
  }, []);

  // Actualiza solo la foto del agente afectado sin recargar la lista completa
  useEffect(() => {
    const handler = (e) => {
      setAgentes(prev => prev.map(a =>
        a.id === e.detail.id ? { ...a, foto_perfil: e.detail.foto_perfil } : a
      ));
    };
    window.addEventListener('agente:foto-actualizada', handler);
    return () => window.removeEventListener('agente:foto-actualizada', handler);
  }, []);

  /**
   * Crea un nuevo agente y recarga la lista.
   * @param {object} formData - { nombre, email, password, rol, area }
   * @throws {Error} Si la respuesta del servidor no es OK.
   */
  const crearAgente = useCallback(async (formData) => {
    const res = await apiService.crearAgente(formData);
    await cargar(true);
    return res;
  }, [cargar]);

  /**
   * Edita un agente existente y recarga la lista.
   * @param {number} id       - PK del agente.
   * @param {object} formData - { nombre, email, rol, area, password? }
   */
  const editarAgente = useCallback(async (id, formData) => {
    await apiService.editarAgente(id, formData);
    await cargar();
  }, [cargar]);

  /**
   * Elimina un agente por ID y recarga la lista.
   * @param {number} id - PK del agente.
   */
  const eliminarAgente = useCallback(async (id) => {
    await apiService.eliminarAgente(id);
    await cargar();
  }, [cargar]);

  return { agentes, loading, crearAgente, editarAgente, eliminarAgente };
}
