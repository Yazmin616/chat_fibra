/**
 * @file useNotifications.js
 * @description Hook de React para notificaciones y alerta sonora.
 *
 * Estrategia dual:
 *  - HTTPS / localhost: intenta además usar la Notification API nativa del OS.
 *  - HTTP (red local sin SSL): muestra un toast in-app (siempre funciona).
 *
 * Uso:
 *   const { notify } = useNotifications();
 *   notify('Nuevo mensaje', 'Hola, ¿en qué les puedo ayudar?');
 */

import { useEffect } from 'react';

/* ── CSS de los toasts (inyectado una sola vez en <head>) ── */
const TOAST_STYLES = `
@keyframes _toast-in  { from { opacity:0; transform:translateX(110%) } to { opacity:1; transform:translateX(0) } }
@keyframes _toast-out { from { opacity:1; transform:translateX(0) }    to { opacity:0; transform:translateX(110%) } }

#_toast-root {
  position: fixed;
  top: 70px; right: 16px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

._toast {
  background: #1e293b;
  color: #f8fafc;
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 290px;
  min-width: 200px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  border-left: 4px solid #dc2626;
  pointer-events: all;
  animation: _toast-in 0.25s cubic-bezier(.22,1,.36,1) both;
}

._toast._out { animation: _toast-out 0.25s ease both; }

._toast-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 3px;
}

._toast-body {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;

function _ensureStyles() {
  if (document.getElementById('_toast-css')) return;
  const s = document.createElement('style');
  s.id = '_toast-css';
  s.textContent = TOAST_STYLES;
  document.head.appendChild(s);
}

function _getRoot() {
  let root = document.getElementById('_toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = '_toast-root';
    document.body.appendChild(root);
  }
  return root;
}

function _showToast(titulo, cuerpo) {
  _ensureStyles();
  const root  = _getRoot();
  const toast = document.createElement('div');
  toast.className = '_toast';
  toast.innerHTML = `
    <div class="_toast-title">${titulo}</div>
    <div class="_toast-body">${cuerpo}</div>
  `;
  root.appendChild(toast);

  // Auto-cerrar con animación de salida
  const remove = () => {
    toast.classList.add('_out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const timer = setTimeout(remove, 4000);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

/**
 * @returns {{ notify: (titulo: string, cuerpo: string) => void }}
 */
export function useNotifications() {
  // Solicitar permiso de notificación nativa.
  // Firefox lo permite en HTTP; Chrome solo en HTTPS.
  // Si el navegador lanza error (HTTP + Chrome), se captura silenciosamente.
  useEffect(() => {
    if ('Notification' in window) {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (_) {
        // Chrome en HTTP lanza SecurityError — ignorar
      }
    }
  }, []);

  const notify = (titulo, cuerpo) => {
    // Toast in-app — funciona en HTTP y HTTPS
    _showToast(titulo, cuerpo);

    // Notificación nativa del OS — funciona en Firefox/HTTP y en cualquier HTTPS
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(titulo, { body: cuerpo, icon: '/favicon.ico' });
      } catch (_) {}
    }

    // Sonido de alerta
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.play().catch(() => {});
  };

  return { notify };
}
