import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'app_theme';
const THEME_EVENT = 'sistema:theme_changed';

/**
 * Hook modular para gestionar el tema (claro / oscuro) en Chat Interno y la aplicación.
 * Sincroniza el estado con localStorage y emite/escucha eventos globales para reactividad instantánea.
 */
export const useChatTheme = (initialDark) => {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === 'dark';
      }
      return Boolean(initialDark);
    } catch {
      return Boolean(initialDark);
    }
  });

  // Sincronizar si cambia la prop externa (ej: darkMode desde App)
  useEffect(() => {
    if (typeof initialDark === 'boolean') {
      setIsDark(initialDark);
    }
  }, [initialDark]);

  // Aplicar clase chat-dark al body mientras el chat esté activo
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('chat-dark');
    } else {
      document.body.classList.remove('chat-dark');
    }
    return () => {
      document.body.classList.remove('chat-dark');
    };
  }, [isDark]);

  // Escuchar cambios de tema emitidos por otras partes de la app (ej. TopBar)
  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail && typeof e.detail.isDark === 'boolean') {
        setIsDark(prev => (prev !== e.detail.isDark ? e.detail.isDark : prev));
      }
    };

    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange);
  }, []);

  // Función para alternar el tema
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const nextVal = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, nextVal ? 'dark' : 'light');
      } catch (err) {
        console.warn('No se pudo guardar la preferencia de tema:', err);
      }

      // Notificar fuera del render phase de React para evitar re-entrancy bugs
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(THEME_EVENT, { detail: { isDark: nextVal } })
        );
      }, 0);

      return nextVal;
    });
  }, []);

  // Función para establecer el tema explícitamente
  const setTheme = useCallback((dark) => {
    const val = Boolean(dark);
    setIsDark(val);
    try {
      localStorage.setItem(STORAGE_KEY, val ? 'dark' : 'light');
    } catch (err) {
      console.warn('No se pudo guardar la preferencia de tema:', err);
    }
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, { detail: { isDark: val } })
      );
    }, 0);
  }, []);

  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
    toggleTheme,
    setTheme,
  };
};

export default useChatTheme;
