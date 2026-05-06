import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Shield, User, Power, Mail, Briefcase } from 'lucide-react';

const AgentManagementView = () => {
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'asesor',
    area: 'Ventas'
  });

  useEffect(() => {
    fetchAgentes();
  }, []);

  const fetchAgentes = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3009/agente`);
      const data = await res.json();
      setAgentes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://${window.location.hostname}:3009/agente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert("Agente creado con éxito");
        setShowForm(false);
        setFormData({ nombre: '', email: '', password: '', rol: 'asesor', area: 'Ventas' });
        fetchAgentes();
      }
    } catch (err) {
      alert("Error al crear agente");
    }
  };

  const eliminarAgente = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar a este agente? Sus chats quedarán sin asignar.")) return;
    try {
      await fetch(`http://${window.location.hostname}:3009/agente/${id}`, { method: 'DELETE' });
      fetchAgentes();
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  return (
    <div className="agent-mgmt-container">
      <div className="settings-header">
        <div>
          <h2>Gestión de Agentes</h2>
          <p>Crea y administra las cuentas de tu equipo de trabajo.</p>
        </div>
        <button className="btn-save" onClick={() => setShowForm(!showForm)}>
          <UserPlus size={18} style={{ marginRight: '8px' }} />
          {showForm ? 'Cerrar Formulario' : 'Nuevo Agente'}
        </button>
      </div>

      {showForm && (
        <div className="settings-card" style={{ marginBottom: '30px', animation: 'slideDown 0.3s' }}>
          <form onSubmit={handleSubmit} className="agent-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre Completo</label>
                <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Rol del Sistema</label>
                <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                  <option value="asesor">Asesor (Solo área asignada)</option>
                  <option value="admin">Administrador (Acceso total)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Área / Departamento</label>
                <select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})}>
                  <option value="Ventas">Ventas</option>
                  <option value="Cobranza">Cobranza</option>
                  <option value="Soporte Técnico">Soporte Técnico</option>
                  <option value="General">General / Recepción</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-save" style={{ marginTop: '20px' }}>Crear Cuenta</button>
          </form>
        </div>
      )}

      <div className="agent-list-grid">
        {agentes.map(agente => (
          <div key={agente.id} className="agent-card">
            <div className="agent-card-header">
              <div className={`online-indicator ${agente.esta_online ? 'online' : 'offline'}`} />
              {agente.rol === 'admin' ? <Shield size={16} color="#00a884" /> : <User size={16} color="#54656f" />}
              <span className="agent-rol-tag">{agente.rol}</span>
            </div>
            
            <div className="agent-card-body">
              <h3>{agente.nombre}</h3>
              <div className="agent-detail">
                <Mail size={14} /> <span>{agente.email}</span>
              </div>
              <div className="agent-detail">
                <Briefcase size={14} /> <span>{agente.area}</span>
              </div>
            </div>

            <div className="agent-card-footer">
              <div className="status-badge">
                <Power size={12} /> {agente.esta_online ? 'En línea' : 'Desconectado'}
              </div>
              <button className="delete-agent-btn" onClick={() => eliminarAgente(agente.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentManagementView;
