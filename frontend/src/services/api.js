const API_URL = `http://${window.location.hostname}:3009`;

export const apiService = {
  async login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },
  async logout(agente_id) {
    const res = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agente_id })
    });
    return res.json();
  },

  // Configuraciones (Filtradas por empresa)
  async getConfigs(empresa_id) {
    const res = await fetch(`${API_URL}/configuracion?empresa_id=${empresa_id}`);
    return res.json();
  },
  async updateConfig(clave, valor, empresa_id) {
    const res = await fetch(`${API_URL}/configuracion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, valor, empresa_id })
    });
    return res.json();
  },

  // Conversaciones (Filtradas por empresa)
  async getConversaciones(empresa_id, agente_id) {
    const res = await fetch(`${API_URL}/conversaciones?empresa_id=${empresa_id}&agente_id=${agente_id || ''}`);
    return res.json();
  },
  async getMensajes(usuarioId, agente_id, conversacion_id) {
    const params = new URLSearchParams({ agente_id: agente_id || '' });
    if (conversacion_id) params.append('conversacion_id', conversacion_id);
    const res = await fetch(`${API_URL}/conversaciones/por-usuario/${usuarioId}?${params.toString()}`);
    return res.json();
  },

  // Acciones de Agente (La conversacion_id ya es única, no necesita empresa_id extra aquí)
  async responder(conversacion_id, user_id, mensaje, agente_id) {
    const res = await fetch(`${API_URL}/agente/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversacion_id, user_id, mensaje, agente_id })
    });
    return res.json();
  },
  async cerrarChat(conversacion_id, motivo, agente_nombre) {
    const res = await fetch(`${API_URL}/agente/liberar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversacion_id, motivo, agente_nombre })
    });
    return res.json();
  },
  async eliminarChat(id) {
    const res = await fetch(`${API_URL}/agente/conversacion/${id}`, { method: "DELETE" });
    return res.json();
  },
  async marcarLeido(id) {
    const res = await fetch(`${API_URL}/conversaciones/marcar-leido/${id}`, { method: "POST" });
    return res.json();
  },

  // Contactos
  async getContactos() {
    const res = await fetch(`${API_URL}/contactos`);
    return res.json();
  },
  async updateContacto(id, data) {
    const res = await fetch(`${API_URL}/contactos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};
