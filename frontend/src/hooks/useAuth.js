import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

// Decodifica el payload del JWT sin verificar firma (la verificación real ocurre en el servidor).
// Solo se usa para leer el campo `exp` y saber si el token ya venció localmente.
function tokenExpirado(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp viene en segundos; Date.now() en milisegundos
    return !payload.exp || Date.now() >= payload.exp * 1000;
  } catch {
    return true; // token malformado → tratar como expirado
  }
}

function limpiarSesion() {
  localStorage.removeItem('agente_user');
  localStorage.removeItem('agente_token');
}

export function useAuth() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('agente_token');
    const saved = localStorage.getItem('agente_user');
    // Si no hay token, o ya expiró, limpiar y forzar login
    if (!token || !saved || tokenExpirado(token)) {
      limpiarSesion();
      return null;
    }
    return JSON.parse(saved);
  });

  // Cerrar sesión automáticamente cuando cualquier petición recibe 401
  useEffect(() => {
    const handleExpired = () => {
      limpiarSesion();
      setUser(null);
    };
    window.addEventListener('session:expired', handleExpired);
    return () => window.removeEventListener('session:expired', handleExpired);
  }, []);

  // Verificar expiración del token cada minuto mientras la sesión está abierta.
  // Así el usuario es deslogueado en cuanto el token vence, sin necesidad de hacer
  // una petición al servidor.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      const token = localStorage.getItem('agente_token');
      if (!token || tokenExpirado(token)) {
        limpiarSesion();
        setUser(null);
      }
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  // Heartbeat: confirma al backend cada 5 minutos que el agente sigue activo.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      apiService.heartbeat().catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  const login = (data) => {
    setUser(data.agente);
    localStorage.setItem('agente_user',  JSON.stringify(data.agente));
    localStorage.setItem('agente_token', data.token);
  };

  const logout = async () => {
    try {
      if (user) await apiService.logout();
    } catch (_) {
      // Token expirado o sin red — igual limpiamos la sesión local
    }
    limpiarSesion();
    setUser(null);
  };

  const actualizarUsuario = useCallback((datos) => {
    setUser(prev => {
      const updated = { ...prev, ...datos };
      localStorage.setItem('agente_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { user, login, logout, actualizarUsuario };
}
