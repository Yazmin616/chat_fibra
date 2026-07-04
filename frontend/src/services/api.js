/**
 * @file api.js
 * @description Capa de comunicación con el backend.
 * Centraliza todas las llamadas HTTP para que los componentes y hooks
 * no tengan que saber la URL ni el formato de cada endpoint.
 *
 * Todas las funciones son async y devuelven el JSON parseado de la respuesta.
 * Las peticiones autenticadas incluyen automáticamente el token JWT
 * almacenado en localStorage bajo la clave "agente_token".
 *
 * Uso:
 *   import { apiService } from './services/api';
 *   const convs = await apiService.getConversaciones('fibratec', 1);
 */

// En producción nginx sirve el frontend Y el API por el mismo puerto,
// así que usamos window.location.origin (ej. http://187.x.x.x:4001).
// En desarrollo el API corre en un puerto separado (3009).
export const API_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : (process.env.REACT_APP_API_URL || `http://${window.location.hostname}:3009`);

/**
 * Convierte una url_media almacenada en BD al src final para el navegador.
 * Las urls de stickers/fotos de Telegram se guardan como `tg://empresa_id/file_id`
 * y se resuelven a través del proxy del backend para evitar la expiración de URLs.
 * Las URLs directas (https://) y las de maps se pasan sin cambios.
 * @param {string|null} url
 * @returns {string|null}
 */
export const resolveMedia = (url) => {
  if (!url) return null;
  if (url.startsWith('tg://')) {
    return `${API_URL}/agente/media/${url.slice(5)}`;
  }
  if (url.startsWith('wa://')) {
    return `${API_URL}/agente/wa-media/${url.slice(5)}`;
  }
  if (url.startsWith('st://')) {
    return `${API_URL}/agente/sticker-file/${url.slice(5)}`;
  }
  if (url.startsWith('rr://')) {
    return `${API_URL}/uploads/rr-media/${url.slice(5)}`;
  }
  return url;
};

/** Convierte la ruta relativa del avatar almacenada en BD al src completo. */
export const resolveAvatar = (url) => {
  if (!url) return null;
  return `${API_URL}${url}`;
};

/** Lee el token JWT del almacenamiento local y construye los headers comunes. */
const _authHeaders = (extra = {}) => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${localStorage.getItem('agente_token') || ''}`,
  ...extra,
});

/** Headers solo con auth (sin Content-Type) — para FormData con multer. */
const _authHeadersMultipart = () => ({
  'Authorization': `Bearer ${localStorage.getItem('agente_token') || ''}`,
});

/**
 * Parsea la respuesta JSON y lanza un error si el servidor devolvió un status
 * de error (4xx / 5xx). Evita que un objeto {"error":"..."} llegue al estado.
 * Si el status es 401, emite el evento global "session:expired" para que
 * useAuth lo intercepte y cierre la sesión automáticamente.
 * @private
 */
async function _parseJson(res) {
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('session:expired'));
    }
    if (res.status === 503 && data?.mantenimiento) {
      window.dispatchEvent(new CustomEvent('sistema:mantenimiento'));
    }
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const apiService = {

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────

  /**
   * Autentica al agente y obtiene el token JWT.
   * @param {string} email    - Email del agente.
   * @param {string} password - Contraseña en texto plano.
   * @returns {Promise<{token: string, agente: object}>}
   */
  async getCanalesStatus() {
    const res = await fetch(`${API_URL}/auth/canales-status`);
    return _parseJson(res);
  },

  async login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    return _parseJson(res);
  },

  /**
   * Notifica al backend que el agente está escribiendo → envía sendChatAction('typing') a Telegram.
   * Se llama con debounce desde ChatWindow cada vez que el agente teclea.
   * @param {string} external_id - Telegram User ID del cliente.
   * @param {string} empresa_id  - Empresa del bot a través del cual enviar la acción.
   * @returns {Promise<{ok: boolean}>}
   */
  async sendTyping(external_id, empresa_id, canal = 'telegram', conversacion_id = null) {
    const res = await fetch(`${API_URL}/agente/escribiendo`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ external_id, empresa_id, canal, conversacion_id }),
    });
    return _parseJson(res);
  },

  /**
   * Cierra sesión del agente (lo marca como offline en DB).
   * El agente_id se extrae del token JWT en el backend.
   * @returns {Promise<{ok: boolean}>}
   */
  async logout() {
    const res = await fetch(`${API_URL}/auth/logout`, {
      method:  'POST',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  /**
   * Confirma al backend que el agente sigue activo (actualiza last_seen).
   * El frontend lo llama cada 5 minutos en segundo plano.
   * @returns {Promise<{ok: boolean}>}
   */
  async heartbeat() {
    const res = await fetch(`${API_URL}/auth/heartbeat`, {
      method:  'POST',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // CONFIGURACIONES
  // ─────────────────────────────────────────────

  /**
   * Obtiene todas las configuraciones de una empresa como objeto { clave: valor }.
   * @param {string} empresa_id - ID de la empresa.
   * @returns {Promise<object>}
   */
  async getConfigs(empresa_id) {
    const res = await fetch(`${API_URL}/configuracion?empresa_id=${empresa_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  /**
   * Crea o actualiza un par clave-valor de configuración para una empresa.
   * @param {string} clave      - Nombre de la configuración (ej. "tiempo_inactividad").
   * @param {string} valor      - Valor a guardar.
   * @param {string} empresa_id - ID de la empresa.
   * @returns {Promise<{ok: boolean}>}
   */
  async updateConfig(clave, valor, empresa_id) {
    const res = await fetch(`${API_URL}/configuracion`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ clave, valor, empresa_id }),
    });
    return _parseJson(res);
  },

  async getPlantillasBot(empresa_id) {
    const qs = new URLSearchParams();
    if (empresa_id) qs.append('empresa_id', empresa_id);
    const res = await fetch(`${API_URL}/configuracion/plantillas?${qs.toString()}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async updatePlantillaBot(clave, texto, empresa_id) {
    const res = await fetch(`${API_URL}/configuracion/plantillas/${clave}`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ texto, empresa_id }),
    });
    return _parseJson(res);
  },

  async getMenusBot(empresa_id) {
    const qs = new URLSearchParams();
    if (empresa_id) qs.append('empresa_id', empresa_id);
    const res = await fetch(`${API_URL}/configuracion/menus?${qs.toString()}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async updateMenuBotButton(menuId, buttonId, texto, activo, empresa_id) {
    const res = await fetch(`${API_URL}/configuracion/menus/${menuId}/${buttonId}`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ texto, activo, empresa_id }),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // CONVERSACIONES
  // ─────────────────────────────────────────────

  /**
   * Obtiene la lista de conversaciones visibles para el agente.
   * @param {string} empresa_id - "todas" o ID concreto.
   * @param {number} agente_id  - PK del agente (determina qué puede ver).
   * @returns {Promise<object[]>}
   */
  async getConversaciones(empresa_id, agente_id) {
    const res = await fetch(
      `${API_URL}/conversaciones?empresa_id=${empresa_id}&agente_id=${agente_id || ''}`,
      { headers: _authHeaders() }
    );
    return _parseJson(res);
  },

  /**
   * Obtiene el historial de mensajes de un usuario, filtrado por rol.
   * @param {number}           usuarioId       - PK del usuario.
   * @param {number}           agente_id       - PK del agente solicitante.
   * @param {number|undefined} conversacion_id - PK de la conversación activa (undefined para Admin).
   * @returns {Promise<object[]>}
   */
  async getMensajes(usuarioId, agente_id, conversacion_id) {
    const params = new URLSearchParams({ agente_id: agente_id || '' });
    if (conversacion_id) params.append('conversacion_id', conversacion_id);
    const res = await fetch(
      `${API_URL}/conversaciones/por-usuario/${usuarioId}?${params.toString()}`,
      { headers: _authHeaders() }
    );
    return _parseJson(res);
  },

  /**
   * Marca todos los mensajes de una conversación como leídos.
   * @param {number} id - PK de la conversación.
   * @returns {Promise<{ok: boolean}>}
   */
  async marcarLeido(id) {
    const res = await fetch(`${API_URL}/conversaciones/marcar-leido/${id}`, {
      method:  'POST',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // ACCIONES DE CHAT (agente → cliente)
  // ─────────────────────────────────────────────

  /**
   * Envía un mensaje del agente al cliente.
   * @param {number} conversacion_id - PK de la conversación.
   * @param {string} user_id         - ID externo del cliente en Telegram.
   * @param {string} mensaje         - Texto a enviar.
   * @param {number} agente_id       - PK del agente que envía.
   * @returns {Promise<{ok: boolean}>}
   */
  /**
   * Envía una imagen o nota de voz al cliente.
   * @param {number} conversacion_id
   * @param {number} agente_id
   * @param {'photo'|'voice'} tipo
   * @param {Blob|File}  archivo  - Blob comprimido (foto) o Blob de audio.
   * @param {string}     [caption]
   */
  async enviarMedia(conversacion_id, agente_id, tipo, archivo, caption = '') {
    const form = new FormData();
    form.append('conversacion_id', conversacion_id);
    form.append('agente_id',       agente_id);
    form.append('tipo',            tipo);
    form.append('caption',         caption);
    form.append('archivo',         archivo, tipo === 'voice' ? 'voice.webm' : 'photo.jpg');
    const res = await fetch(`${API_URL}/agente/enviar-media`, {
      method:  'POST',
      headers: _authHeadersMultipart(),
      body:    form,
    });
    return _parseJson(res);
  },

  async responder(conversacion_id, user_id, mensaje, agente_id) {
    const res = await fetch(`${API_URL}/agente/responder`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ conversacion_id, user_id, mensaje, agente_id }),
    });
    return _parseJson(res);
  },

  /**
   * Cierra el chat: notifica al cliente con encuesta CSAT y libera al agente.
   * @param {number} conversacion_id - PK de la conversación.
   * @param {string} motivo          - Motivo del cierre.
   * @param {string} agente_nombre   - Nombre del agente que cierra.
   * @returns {Promise<{ok: boolean}>}
   */
  async cerrarChat(conversacion_id, categoria_cierre_id, comentario_cierre, agente_nombre) {
    const res = await fetch(`${API_URL}/agente/liberar`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ conversacion_id, categoria_cierre_id, comentario_cierre, agente_nombre }),
    });
    return _parseJson(res);
  },

  /**
   * Borrado total (GDPR): elimina todos los datos del usuario asociado.
   * @param {number} id - PK de cualquier conversación del usuario.
   * @returns {Promise<{ok: boolean}>}
   */
  async eliminarChat(id) {
    const res = await fetch(`${API_URL}/agente/conversacion/${id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // TRANSFERENCIAS
  // ─────────────────────────────────────────────

  /**
   * Transfiere un chat a la cola de un equipo (mismo o distinto área).
   * @param {number} conversacion_id - PK de la conversación.
   * @param {string} area_destino    - Área destino.
   * @param {string} nota            - Nota de contexto (obligatoria).
   * @returns {Promise<{ok: boolean, tipo: string, area_destino: string}>}
   */
  async transferirChat(conversacion_id, area_destino, nota) {
    const res = await fetch(`${API_URL}/transferencias/transferir`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ conversacion_id, area_destino, nota }),
    });
    return _parseJson(res);
  },

  /**
   * Obtiene el historial de transferencias de una conversación.
   * @param {number} conversacion_id
   * @returns {Promise<object[]>}
   */
  async getTransferencias(conversacion_id) {
    const res = await fetch(`${API_URL}/transferencias/conversacion/${conversacion_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  /**
   * Lista todas las transferencias (solo admin/supervisor).
   * @param {string} empresa_id - "todas" o ID concreto.
   * @returns {Promise<object[]>}
   */
  async getAllTransferencias(empresa_id = 'todas') {
    const res = await fetch(`${API_URL}/transferencias?empresa_id=${empresa_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // CONTACTOS
  // ─────────────────────────────────────────────

  /**
   * Lista todos los usuarios del sistema con sus métricas de interacción.
   * @returns {Promise<object[]>}
   */
  async getContactos() {
    const res = await fetch(`${API_URL}/contactos`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  /**
   * Actualiza los datos editables de un usuario desde el CRM.
   * @param {number} id   - PK del usuario.
   * @param {object} data - { nombre: string, telefono: string }
   * @returns {Promise<{message: string}>}
   */
  async updateContacto(id, data) {
    const res = await fetch(`${API_URL}/contactos/${id}`, {
      method:  'PUT',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // AGENTES
  // ─────────────────────────────────────────────

  /**
   * Lista todos los agentes registrados en el sistema.
   * @returns {Promise<object[]>}
   */
  async getAgentes() {
    const res = await fetch(`${API_URL}/agente`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  /**
   * Crea un nuevo agente en el sistema.
   * @param {object} data - { nombre, email, password, rol, area }
   * @returns {Promise<{ok: boolean, agente: object}>}
   * @throws {Error} Si el servidor responde con un código de error.
   */
  async crearAgente(data) {
    const res = await fetch(`${API_URL}/agente`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Error al crear agente');
    }
    return _parseJson(res);
  },

  /**
   * Elimina un agente por su ID. Sus conversaciones quedan sin asignar.
   * @param {number} id - PK del agente.
   * @returns {Promise<{ok: boolean}>}
   */
  async editarAgente(id, data) {
    const res = await fetch(`${API_URL}/agente/${id}`, {
      method:  'PUT',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Error al editar agente');
    }
    return _parseJson(res);
  },

  async eliminarAgente(id) {
    const res = await fetch(`${API_URL}/agente/${id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async subirFotoPerfil(agente_id, file) {
    const form = new FormData();
    form.append('foto', file);
    const res = await fetch(`${API_URL}/agente/${agente_id}/foto`, {
      method:  'PATCH',
      headers: _authHeadersMultipart(),
      body:    form,
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────

  /**
   * Obtiene los KPIs y estadísticas del dashboard.
   * @param {number} agente_id  - PK del agente solicitante (filtra si es asesor).
   * @param {string} empresa_id - ID de empresa activa o "todas".
   * @returns {Promise<{
   *   kpis:                  object,
   *   calificaciones:        object,
   *   actividadDiaria:       object[],
   *   topAgentes:            object[],
   *   ultimasCalificaciones: object[]
   * }>}
   */
  async getDashboard(agente_id, empresa_id, filtro_agente_id, filtro_area) {
    const params = new URLSearchParams({ agente_id: agente_id || '', empresa_id: empresa_id || '' });
    if (filtro_agente_id) params.append('filtro_agente_id', filtro_agente_id);
    if (filtro_area)      params.append('filtro_area', filtro_area);
    const res = await fetch(`${API_URL}/agente/dashboard?${params.toString()}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getInfracciones(agente_id, empresa_id) {
    const params = new URLSearchParams({ agente_id: agente_id || '', empresa_id: empresa_id || '' });
    const res = await fetch(`${API_URL}/agente/infracciones?${params}`, { headers: _authHeaders() });
    return _parseJson(res);
  },

  async getInfraccionesHoy(agente_id, empresa_id) {
    const params = new URLSearchParams({ agente_id: agente_id || '', empresa_id: empresa_id || '' });
    const res = await fetch(`${API_URL}/agente/infracciones/hoy?${params}`, { headers: _authHeaders() });
    return _parseJson(res);
  },

  async getCalificaciones(agente_id, empresa_id, filtro_agente_id, filtro_area) {
    const params = new URLSearchParams({ agente_id: agente_id || '', empresa_id: empresa_id || '' });
    if (filtro_agente_id) params.append('filtro_agente_id', filtro_agente_id);
    if (filtro_area)      params.append('filtro_area', filtro_area);
    const res = await fetch(`${API_URL}/agente/dashboard/calificaciones?${params.toString()}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getAgenteStats(id) {
    const res = await fetch(`${API_URL}/agente/dashboard/asesor/${id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // RESPUESTAS RÁPIDAS
  // ─────────────────────────────────────────────

  async reaccionar(mensaje_id, emoji) {
    const res = await fetch(`${API_URL}/agente/reaccionar`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ mensaje_id, emoji: emoji || null }),
    });
    return _parseJson(res);
  },

  async getRespuestasRapidas() {
    const res = await fetch(`${API_URL}/agente/respuestas-rapidas`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async crearRespuestaRapida(titulo, contenido, mediaFile = null) {
    const form = new FormData();
    form.append('titulo', titulo);
    if (contenido) form.append('contenido', contenido);
    if (mediaFile) form.append('media', mediaFile);
    const res = await fetch(`${API_URL}/agente/respuestas-rapidas`, {
      method:  'POST',
      headers: _authHeadersMultipart(),
      body:    form,
    });
    return _parseJson(res);
  },

  async actualizarRespuestaRapida(id, titulo, contenido, mediaFile = null, removeMedia = false) {
    const form = new FormData();
    form.append('titulo', titulo);
    if (contenido) form.append('contenido', contenido);
    if (removeMedia) form.append('removeMedia', 'true');
    if (mediaFile) form.append('media', mediaFile);
    const res = await fetch(`${API_URL}/agente/respuestas-rapidas/${id}`, {
      method:  'PUT',
      headers: _authHeadersMultipart(),
      body:    form,
    });
    return _parseJson(res);
  },

  async eliminarRespuestaRapida(id) {
    const res = await fetch(`${API_URL}/agente/respuestas-rapidas/${id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async usarRespuestaRapida(conversacion_id, rr_id) {
    const res = await fetch(`${API_URL}/agente/respuestas-rapidas/usar`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ conversacion_id, rr_id }),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // STICKERS
  // ─────────────────────────────────────────────

  async getStickers() {
    const res = await fetch(`${API_URL}/agente/stickers`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async deletePersonalSticker(agente_id, file) {
    const res = await fetch(`${API_URL}/agente/stickers/mine/${encodeURIComponent(file)}`, {
      method:  'DELETE',
      headers: _authHeaders(),
      body:    JSON.stringify({ agente_id }),
    });
    return _parseJson(res);
  },

  async getStickerFavoritos(agente_id) {
    const res = await fetch(`${API_URL}/agente/stickers/favoritos?agente_id=${agente_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async addStickerFavorito(agente_id, pack, file) {
    const res = await fetch(`${API_URL}/agente/stickers/favorito`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ agente_id, pack, file }),
    });
    return _parseJson(res);
  },

  async removeStickerFavorito(agente_id, pack, file) {
    const res = await fetch(`${API_URL}/agente/stickers/favorito`, {
      method:  'DELETE',
      headers: _authHeaders(),
      body:    JSON.stringify({ agente_id, pack, file }),
    });
    return _parseJson(res);
  },

  async enviarSticker(conversacion_id, agente_id, pack, file) {
    const res = await fetch(`${API_URL}/agente/sticker`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ conversacion_id, agente_id, pack, file }),
    });
    return _parseJson(res);
  },

  async saveClientSticker(agente_id, url_media) {
    const res = await fetch(`${API_URL}/agente/stickers/save-from-wa`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ agente_id, url_media }),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // HORARIOS — turnos por área y festivos
  // ─────────────────────────────────────────────

  async getAreas(empresa_id) {
    const res = await fetch(`${API_URL}/horarios/areas?empresa_id=${empresa_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getTurnos(empresa_id, area) {
    const params = new URLSearchParams({ empresa_id });
    if (area !== undefined) params.append('area', area);
    const res = await fetch(`${API_URL}/horarios/turnos?${params}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async crearTurno(data) {
    const res = await fetch(`${API_URL}/horarios/turnos`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    return _parseJson(res);
  },

  async actualizarTurno(id, data) {
    const res = await fetch(`${API_URL}/horarios/turnos/${id}`, {
      method:  'PUT',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    return _parseJson(res);
  },

  async eliminarTurno(id) {
    const res = await fetch(`${API_URL}/horarios/turnos/${id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getFestivos(empresa_id) {
    const res = await fetch(`${API_URL}/horarios/festivos?empresa_id=${empresa_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async crearFestivo(data) {
    const res = await fetch(`${API_URL}/horarios/festivos`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    return _parseJson(res);
  },

  async eliminarFestivo(id) {
    const res = await fetch(`${API_URL}/horarios/festivos/${id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // ETIQUETAS
  // ─────────────────────────────────────────────

  // area: null | 'todas' | '__general__' | 'Soporte Técnico' | 'Ventas' | 'Cobranza'
  async listarEtiquetas(empresa_id, q, area) {
    const qs = new URLSearchParams({ empresa_id });
    if (q)    qs.set('q',    q);
    if (area && area !== 'todas') {
      // '__general__' se mapea a 'general' para que el backend filtre IS NULL
      qs.set('area', area === '__general__' ? '__general__' : area);
    }
    const res = await fetch(`${API_URL}/etiquetas?${qs}`, { headers: _authHeaders() });
    return _parseJson(res);
  },

  async crearEtiqueta(data) {
    const res = await fetch(`${API_URL}/etiquetas`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    return _parseJson(res);
  },

  async actualizarEtiqueta(id, data) {
    const res = await fetch(`${API_URL}/etiquetas/${id}`, {
      method:  'PUT',
      headers: _authHeaders(),
      body:    JSON.stringify(data),
    });
    return _parseJson(res);
  },

  async eliminarEtiqueta(id, empresa_id) {
    const res = await fetch(`${API_URL}/etiquetas/${id}?empresa_id=${empresa_id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getEtiquetasConversacion(conversacion_id) {
    const res = await fetch(`${API_URL}/etiquetas/conversacion/${conversacion_id}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async asignarEtiqueta(conversacion_id, etiqueta_id) {
    const res = await fetch(`${API_URL}/etiquetas/conversacion/${conversacion_id}`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ etiqueta_id }),
    });
    return _parseJson(res);
  },

  async quitarEtiqueta(conversacion_id, etiqueta_id) {
    const res = await fetch(`${API_URL}/etiquetas/conversacion/${conversacion_id}/${etiqueta_id}`, {
      method:  'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // CATEGORÍAS DE CIERRE
  // ─────────────────────────────────────────────
  async listarCategoriasCierre(empresa_id, q, area) {
    const qs = new URLSearchParams({ empresa_id });
    if (q) qs.set('q', q);
    if (area && area !== 'todas') qs.set('area', area === '__general__' ? '__general__' : area);
    const res = await fetch(`${API_URL}/categorias-cierre?${qs}`, { headers: _authHeaders() });
    return _parseJson(res);
  },
  async crearCategoriaCierre(data) {
    const res = await fetch(`${API_URL}/categorias-cierre`, {
      method: 'POST', headers: _authHeaders(), body: JSON.stringify(data),
    });
    return _parseJson(res);
  },
  async actualizarCategoriaCierre(id, data) {
    const res = await fetch(`${API_URL}/categorias-cierre/${id}`, {
      method: 'PUT', headers: _authHeaders(), body: JSON.stringify(data),
    });
    return _parseJson(res);
  },
  async eliminarCategoriaCierre(id, empresa_id) {
    const res = await fetch(`${API_URL}/categorias-cierre/${id}?empresa_id=${empresa_id}`, {
      method: 'DELETE', headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // PERMISOS
  // ─────────────────────────────────────────────
  async getMisPermisos() {
    const res = await fetch(`${API_URL}/permisos/mi`, { headers: _authHeaders() });
    return _parseJson(res);
  },
  async getPermisosUsuario(id) {
    const res = await fetch(`${API_URL}/permisos/${id}`, { headers: _authHeaders() });
    return _parseJson(res);
  },
  async setPermisosUsuario(id, data) {
    const res = await fetch(`${API_URL}/permisos/${id}`, {
      method: 'PUT', headers: _authHeaders(), body: JSON.stringify(data),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // PLANTILLAS DE ROL
  // ─────────────────────────────────────────────
  async getRolTemplates() {
    const res = await fetch(`${API_URL}/rol-template`, { headers: _authHeaders() });
    return _parseJson(res);
  },
  async getRolTemplate(rol) {
    const res = await fetch(`${API_URL}/rol-template/${rol}`, { headers: _authHeaders() });
    return _parseJson(res);
  },
  async setRolTemplate(rol, data) {
    const res = await fetch(`${API_URL}/rol-template/${rol}`, {
      method: 'PUT', headers: _authHeaders(), body: JSON.stringify(data),
    });
    return _parseJson(res);
  },
  async applyRolTemplate(rol) {
    const res = await fetch(`${API_URL}/rol-template/${rol}/apply`, {
      method: 'POST', headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // PALABRAS CLAVE DEL BOT
  // ─────────────────────────────────────────────
  async getPalabrasClave(empresa_id = null) {
    const qs = empresa_id ? `?empresa_id=${encodeURIComponent(empresa_id)}` : '';
    const res = await fetch(`${API_URL}/palabras-clave${qs}`, { headers: _authHeaders() });
    return _parseJson(res);
  },
  async crearPalabraClave(data) {
    const res = await fetch(`${API_URL}/palabras-clave`, {
      method: 'POST',
      headers: { ..._authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return _parseJson(res);
  },
  async actualizarPalabraClave(id, data) {
    const res = await fetch(`${API_URL}/palabras-clave/${id}`, {
      method: 'PUT',
      headers: { ..._authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return _parseJson(res);
  },
  async eliminarPalabraClave(id) {
    const res = await fetch(`${API_URL}/palabras-clave/${id}`, {
      method: 'DELETE', headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  // ─────────────────────────────────────────────
  // FLUJOS VISUALES DEL BOT
  // ─────────────────────────────────────────────
  async getFlujo(empresa_id) {
    const res = await fetch(`${API_URL}/flujos/${encodeURIComponent(empresa_id)}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },
  async saveFlujo(empresa_id, payload) {
    const res = await fetch(`${API_URL}/flujos/${encodeURIComponent(empresa_id)}`, {
      method: 'PUT',
      headers: _authHeaders(),
      body: JSON.stringify(payload),
    });
    return _parseJson(res);
  },
  async listFlujos(empresa_id) {
    const res = await fetch(`${API_URL}/flujos/${encodeURIComponent(empresa_id)}/lista`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },
  async toggleFlujoActivo(id, activo) {
    const res = await fetch(`${API_URL}/flujos/${id}/activo`, {
      method: 'PATCH',
      headers: _authHeaders(),
      body: JSON.stringify({ activo }),
    });
    return _parseJson(res);
  },
};
