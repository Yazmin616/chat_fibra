/**
 * @file desktopNotificationHelper.js
 * @description Generador y gestor visual avanzado de notificaciones de escritorio del sistema.
 * Genera avatares con iniciales y gradientes dinamicos estilo WhatsApp,
 * soporta fotos reales de usuarios/canales, previsualizaciones de imagenes adjuntas y
 * sincronizacion de foco y apertura al hacer clic.
 */

const PALETA_COLORES = [
  ['#00a884', '#008069'],
  ['#0284c7', '#0369a1'],
  ['#8b5cf6', '#6d28d9'],
  ['#f59e0b', '#d97706'],
  ['#ec4899', '#be185d'],
  ['#10b981', '#059669'],
  ['#06b6d4', '#0e7490'],
  ['#6366f1', '#4338ca'],
  ['#f97316', '#c2410c'],
];

function getColorGradient(nombre) {
  nombre = nombre || '';
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash << 5) - hash + nombre.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETA_COLORES.length;
  return PALETA_COLORES[index];
}

/**
 * Genera un Data URL PNG de 128x128 con un avatar con iniciales
 */
export function generateAvatarDataUrl(nombre, esGrupo) {
  nombre = nombre || '';
  esGrupo = !!esGrupo;
  if (typeof document === 'undefined') return null;

  try {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const [c1, c2] = getColorGradient(nombre);

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, c1);
    gradient.addColorStop(1, c2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    if (esGrupo || nombre.startsWith('#')) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(size * 0.46) + 'px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('#', size / 2, (size / 2) + 3);
    } else {
      const clean = nombre.replace(/^[@#]/, '').trim();
      const parts = clean.split(/\s+/).filter(Boolean);
      let initials = '';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length >= 2) {
        initials = parts[0].slice(0, 2).toUpperCase();
      } else if (parts.length === 1) {
        initials = parts[0][0].toUpperCase();
      } else {
        initials = 'CI';
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 ' + Math.round(size * 0.40) + 'px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, size / 2, (size / 2) + 2);
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[AvatarGen] Error:', err);
    return null;
  }
}

/**
 * Resuelve una URL completa para que la Notification API del SO la pueda cargar.
 * Retorna null si no puede resolverse correctamente.
 */
export function resolveFullMediaUrl(path) {
  if (!path) return null;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return null;
    if (path.startsWith('/uploads/')) {
      const backendUrl = process.env.REACT_APP_API_URL || origin.replace(/:\d+$/, ':3009');
      return backendUrl.replace(/\/$/, '') + path;
    }
    return new URL(path, origin).href;
  } catch (_) {
    return null;
  }
}

/**
 * Dispara una notificacion de escritorio optimizada para Windows / macOS / Linux
 * Compatible con Chrome, Brave, Firefox, Edge
 */
export function mostrarNotificacionDesktop({
  titulo,
  cuerpo,
  emisorNombre,
  emisorFoto,
  canalFoto,
  canalId,
  canalTipo,
  urlAdjunto,
  tipoAdjunto,
  onClick,
}) {
  titulo = titulo || 'Nuevo mensaje';
  cuerpo = cuerpo || '';
  emisorNombre = emisorNombre || '';
  emisorFoto = emisorFoto || null;
  canalFoto = canalFoto || null;
  canalId = canalId || null;
  canalTipo = canalTipo || 'directo';
  urlAdjunto = urlAdjunto || null;
  tipoAdjunto = tipoAdjunto || null;
  onClick = onClick || null;

  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const esGrupo = canalTipo === 'canal' || (titulo && titulo.startsWith('#'));

    // Icono: primero intentar foto real (URL absoluta http/https), luego logo del sistema.
    // Firefox NO acepta data: URLs como icon — se ignoran silenciosamente.
    // Brave/Chrome sí aceptan data: URLs, pero unificamos para compatibilidad.
    let iconUrl = null;

    const fotoFuente = !esGrupo ? emisorFoto : canalFoto;
    if (fotoFuente) {
      const resolved = resolveFullMediaUrl(fotoFuente);
      if (resolved && (resolved.startsWith('http://') || resolved.startsWith('https://'))) {
        iconUrl = resolved;
      }
    }

    // Fallback: logo del sistema (URL absoluta, siempre funciona en todos los navegadores)
    if (!iconUrl) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      iconUrl = origin + '/logo192.png';
    }

    const options = {
      body: cuerpo || 'Has recibido un nuevo mensaje',
      icon: iconUrl,
      tag: canalId ? ('canal_' + canalId) : ('msg_' + Date.now()),
      renotify: true,
      silent: true,
    };

    // Previa de imagen adjunta (solo Chromium la soporta, Firefox la ignora sin error)
    if (tipoAdjunto === 'imagen' && urlAdjunto) {
      const imgUrl = resolveFullMediaUrl(urlAdjunto);
      if (imgUrl && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'))) {
        options.image = imgUrl;
      }
    }

    const notif = new Notification(titulo, options);

    notif.onclick = () => {
      try { window.focus(); } catch (_) {}
      if (typeof onClick === 'function') {
        try { onClick(); } catch (_) {}
      }
      if (canalId) {
        try {
          window.dispatchEvent(new CustomEvent('sistema:abrir_canal_interno', {
            detail: { canalId: Number(canalId) }
          }));
        } catch (_) {}
      }
      try { notif.close(); } catch (_) {}
    };

    return notif;
  } catch (err) {
    console.warn('[DesktopNotif] Error al mostrar notificacion:', err);
    return null;
  }
}

