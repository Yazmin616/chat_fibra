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
    const withoutScheme = url.slice(5);           // quita "tg://"
    return `${API_URL}/agente/media/${withoutScheme}`;
  }
  return url;
};

/** Lee el token JWT del almacenamiento local y construye los headers comunes. */
const _authHeaders = (extra = {}) => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${localStorage.getItem('agente_token') || ''}`,
  ...extra,
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
  async sendTyping(external_id, empresa_id, canal = 'telegram') {
    const res = await fetch(`${API_URL}/agente/escribiendo`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ external_id, empresa_id, canal }),
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
  async cerrarChat(conversacion_id, motivo, agente_nombre, solucion) {
    const res = await fetch(`${API_URL}/agente/liberar`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ conversacion_id, motivo, agente_nombre, solucion }),
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
};
