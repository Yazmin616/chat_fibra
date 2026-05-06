const API_URL = `http://${window.location.hostname}:3009`;

export const apiService = {
  // Configuraciones
  async getConfigs() {
    const res = await fetch(`${API_URL}/configuracion`);
    return res.json();
  },
  async updateConfig(clave, valor) {
    const res = await fetch(`${API_URL}/configuracion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, valor })
    });
    return res.json();
  },

  // Conversaciones
  async getConversaciones() {
    const res = await fetch(`${API_URL}/conversaciones`);
    return res.json();
  },
  async getMensajes(usuarioId) {
    const res = await fetch(`${API_URL}/conversaciones/por-usuario/${usuarioId}`);
    return res.json();
  },

  // Acciones de Agente
  async responder(conversacion_id, user_id, mensaje) {
    const res = await fetch(`${API_URL}/agente/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversacion_id, user_id, mensaje })
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
  }
};
