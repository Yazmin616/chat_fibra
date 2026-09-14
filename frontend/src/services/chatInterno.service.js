/**
 * @file chatInterno.service.js
 * @description Capa de comunicación HTTP con los endpoints del Chat Interno Corporativo.
 */

import { API_URL } from './api';

const _authHeaders = (extra = {}) => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${localStorage.getItem('agente_token') || ''}`,
  ...extra,
});

const _parseJson = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.error || res.statusText || 'Error en la petición';
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

export const chatInternoService = {
  async getCanales() {
    const res = await fetch(`${API_URL}/chat-interno/canales`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getContactos() {
    const res = await fetch(`${API_URL}/chat-interno/contactos`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async abrirChatDirecto(otroAgenteId) {
    const res = await fetch(`${API_URL}/chat-interno/directo`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ otroAgenteId }),
    });
    return _parseJson(res);
  },

  async crearCanal({ nombre, descripcion, esPrivado, soloLectura, miembroIds, adminIds }) {
    const res = await fetch(`${API_URL}/chat-interno/canales`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ nombre, descripcion, esPrivado, soloLectura, miembroIds, adminIds }),
    });
    return _parseJson(res);
  },

    async eliminarCanal(canalId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}`, {
      method: 'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

    async ocultarConversacion(canalId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/ocultar`, {
      method: 'POST',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async getMensajes(canalId, limit = 50, beforeId = null) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (beforeId) params.set('beforeId', beforeId);

    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/mensajes?${params}`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async enviarMensajeTexto(canalId, mensaje) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/mensajes`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ mensaje, tipo: 'texto' }),
    });
    return _parseJson(res);
  },

  async enviarMensajeAdjunto(canalId, file, mensaje = '') {
    const formData = new FormData();
    formData.append('adjunto', file);
    if (mensaje) formData.append('mensaje', mensaje);

    const token = localStorage.getItem('agente_token') || '';
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/mensajes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return _parseJson(res);
  },

  async marcarLeido(canalId, ultimoMensajeId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/leer`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ ultimoMensajeId }),
    });
    return _parseJson(res);
  },

  async toggleReaccion(mensajeId, emoji, canalId) {
    const res = await fetch(`${API_URL}/chat-interno/mensajes/${mensajeId}/reacciones`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ emoji, canalId }),
    });
    return _parseJson(res);
  },

  async getDetallesCanal(canalId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/detalles`, {
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async agregarMiembro(canalId, agenteId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/miembros`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({ agenteId }),
    });
    return _parseJson(res);
  },

  async removerMiembro(canalId, agenteId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/miembros/${agenteId}`, {
      method: 'DELETE',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },

  async cambiarRolMiembro(canalId, agenteId, rol) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/miembros/${agenteId}/rol`, {
      method: 'PUT',
      headers: _authHeaders(),
      body: JSON.stringify({ rol }),
    });
    return _parseJson(res);
  },

  async toggleFijarCanal(canalId) {
    const res = await fetch(`${API_URL}/chat-interno/canales/${canalId}/fijar`, {
      method: 'POST',
      headers: _authHeaders(),
    });
    return _parseJson(res);
  },
};
