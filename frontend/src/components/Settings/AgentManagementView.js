import React, { useState } from 'react';
import { UserPlus, X, Edit2 } from 'lucide-react';

import { useAgentes } from '../../hooks/useAgentes';
import AgentForm      from '../Agents/AgentForm';
import AgentCard      from '../Agents/AgentCard';

const AgentManagementView = ({ user, actualizarUsuario }) => {
  const { agentes, loading, crearAgente, editarAgente, eliminarAgente } = useAgentes();
  const [showForm,       setShowForm]       = useState(false);
  const [editandoAgente, setEditandoAgente] = useState(null);

  const handleEditar = (agente) => setEditandoAgente(agente);
  const handleCerrarEdicion = () => setEditandoAgente(null);

  const handleGuardarEdicion = async (formData) => {
    await editarAgente(editandoAgente.id, formData);
    // Si el agente editado es el usuario en sesión, reflejar el cambio sin re-login
    if (user && actualizarUsuario && editandoAgente.id === user.id) {
      actualizarUsuario({
        nombre: formData.nombre,
        email:  formData.email,
        rol:    formData.rol,
        area:   formData.area,
      });
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

      {/* Formulario de creación */}
      {showForm && (
        <div className="settings-card" style={{ marginBottom: '30px', animation: 'slideDown 0.3s' }}>
          <AgentForm
            onSubmit={crearAgente}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Grid de tarjetas */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#667781' }}>
          Cargando agentes...
        </div>
      ) : (
        <div className="agent-list-grid">
          {agentes.map(agente => (
            <AgentCard
              key={agente.id}
              agente={agente}
              onEditar={handleEditar}
              onEliminar={eliminarAgente}
            />
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editandoAgente && (
        <div className="agent-edit-overlay" onClick={handleCerrarEdicion}>
          <div className="agent-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="agent-edit-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={16} color="#dc2626" />
                <div>
                  <h3>Editar Agente</h3>
                  <p>{editandoAgente.nombre}</p>
                </div>
              </div>
              <button className="agent-edit-close" onClick={handleCerrarEdicion}>
                <X size={18} />
              </button>
            </div>
            <div className="agent-edit-modal-body">
              <AgentForm
                agente={editandoAgente}
                onSubmit={handleGuardarEdicion}
                onClose={handleCerrarEdicion}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentManagementView;
