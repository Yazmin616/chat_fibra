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
@keyframes _toast-in  {
  0% { opacity: 0; transform: translateY(-12px) scale(0.94); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes _toast-out {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-16px) scale(0.92); }
}
@keyframes _toast-progress {
  0% { width: 100%; }
  100% { width: 0%; }
}

#_toast-root {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

._toast-card {
  position: relative;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: #ffffff;
  padding: 14px 16px;
  border-radius: 14px;
  max-width: 360px;
  min-width: 280px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: all;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  animation: _toast-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

._toast-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.45);
}

._toast-card._out {
  animation: _toast-out 0.22s cubic-bezier(0.4, 0, 1, 1) both;
}

._toast-icon-box {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

._toast-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

._toast-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

._toast-close {
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  font-weight: bold;
  padding: 0 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: color 0.15s ease;
}

._toast-close:hover {
  color: #ffffff;
}

._toast-body {
  font-size: 12.5px;
  line-height: 1.4;
  color: #cbd5e1;
  word-break: break-word;
}

._toast-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  animation: _toast-progress 4s linear forwards;
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

function _getToastMeta(titulo) {
  const t = (titulo || '').toLowerCase();
  
  // Icono SVG: Fijado / Pin
  if (t.includes('fijado') || t.includes('pin')) {
    return {
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`,
      boxBg: 'rgba(99, 102, 241, 0.18)',
      boxBorder: 'rgba(99, 102, 241, 0.35)',
      barBg: 'linear-gradient(90deg, #6366f1, #818cf8)'
    };
  }

  // Icono SVG: Permisos / Administrador / Anfitrión
  if (t.includes('anfitrión') || t.includes('anfitrion') || t.includes('admin') || t.includes('permiso')) {
    return {
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
      boxBg: 'rgba(245, 158, 11, 0.18)',
      boxBorder: 'rgba(245, 158, 11, 0.35)',
      barBg: 'linear-gradient(90deg, #f59e0b, #fbbf24)'
    };
  }

  // Icono SVG: Nuevo Canal / Agregado
  if (t.includes('nuevo') || t.includes('agregado') || t.includes('canal')) {
    return {
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>`,
      boxBg: 'rgba(37, 99, 235, 0.18)',
      boxBorder: 'rgba(37, 99, 235, 0.35)',
      barBg: 'linear-gradient(90deg, #2563eb, #60a5fa)'
    };
  }

  // Icono SVG: Removido / Alerta
  if (t.includes('removido') || t.includes('cerrado') || t.includes('eliminado') || t.includes('error')) {
    return {
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      boxBg: 'rgba(225, 29, 72, 0.18)',
      boxBorder: 'rgba(225, 29, 72, 0.35)',
      barBg: 'linear-gradient(90deg, #e11d48, #f43f5e)'
    };
  }

  // Icono SVG por defecto: Mensaje / Chat
  return {
    iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    boxBg: 'rgba(59, 130, 246, 0.18)',
    boxBorder: 'rgba(59, 130, 246, 0.35)',
    barBg: 'linear-gradient(90deg, #3b82f6, #60a5fa)'
  };
}

function _showToast(titulo, cuerpo) {
  _ensureStyles();
  const root = _getRoot();
  const meta = _getToastMeta(titulo);

  // Limpiar cualquier emoji residual del texto
  const cleanTitle = (titulo || '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim() || titulo;
  const cleanBody = (cuerpo || '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim() || cuerpo;

  const toast = document.createElement('div');
  toast.className = '_toast-card';
  toast.innerHTML = `
    <div class="_toast-icon-box" style="background: ${meta.boxBg}; border-color: ${meta.boxBorder};">
      ${meta.iconSvg}
    </div>
    <div class="_toast-content">
      <div class="_toast-title">
        <span>${cleanTitle}</span>
        <button class="_toast-close" title="Cerrar">✕</button>
      </div>
      <div class="_toast-body">${cleanBody}</div>
    </div>
    <div class="_toast-progress-bar" style="background: ${meta.barBg};"></div>
  `;
  root.appendChild(toast);

  // Auto-cerrar con animación de salida suave
  const remove = () => {
    toast.classList.add('_out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const timer = setTimeout(remove, 4000);
  
  toast.querySelector('._toast-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(timer);
    remove();
  });

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
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
