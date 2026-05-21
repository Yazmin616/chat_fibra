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

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAgentes();
      setAgentes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[useAgentes] cargar:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Recarga la lista cuando el backend notifica cambios de presencia
  useEffect(() => {
    const handler = () => cargar();
    window.addEventListener('agentes:actualizar', handler);
    return () => window.removeEventListener('agentes:actualizar', handler);
  }, [cargar]);

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
    await apiService.crearAgente(formData);
    await cargar();
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
