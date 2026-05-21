import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../services/api';

export function useDashboard({ user, empresaId, socket, filtroAgente, filtroArea }) {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const json = await apiService.getDashboard(user?.id, empresaId, filtroAgente, filtroArea);
      setData(json);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[useDashboard] fetchDashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, empresaId, filtroAgente, filtroArea]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchDashboard(true);
    socket.on('nuevo_mensaje',            handleUpdate);
    socket.on('conversacion_actualizada', handleUpdate);
    socket.on('nueva_calificacion',       handleUpdate);
    socket.on('conversacion_eliminada',   handleUpdate);
    return () => {
      socket.off('nuevo_mensaje',            handleUpdate);
      socket.off('conversacion_actualizada', handleUpdate);
      socket.off('nueva_calificacion',       handleUpdate);
      socket.off('conversacion_eliminada',   handleUpdate);
    };
  }, [socket, fetchDashboard]);

  return { data, loading, lastUpdate, currentTime, fetchDashboard };
}
