import React, { useState } from 'react';
import { UserPlus, X, Edit2, Shield } from 'lucide-react';

import { useAgentes }    from '../../hooks/useAgentes';
import AgentForm         from '../Agents/AgentForm';
import AgentCard         from '../Agents/AgentCard';
import PermisosEditor    from '../Agents/PermisosEditor';

const AgentManagementView = ({ user, actualizarUsuario }) => {
  const { agentes, loading, crearAgente, editarAgente, eliminarAgente } = useAgentes();
  const [creando,        setCreando]        = useState(false);
  const [editandoAgente, setEditandoAgente] = useState(null);
  const [tabActivo,      setTabActivo]      = useState('datos'); // 'datos' | 'permisos'

  const handleEditar = (agente) => {
    setEditandoAgente(agente);
    setTabActivo('datos');
  };

  const handleCerrarEdicion = () => {
    setEditandoAgente(null);
    setTabActivo('datos');
  };

  const handleGuardarEdicion = async (formData) => {
    await editarAgente(editandoAgente.id, formData);
    if (user && actualizarUsuario && editandoAgente.id === user.id) {
      actualizarUsuario({ nombre: formData.nombre, email: formData.email, rol: formData.rol, area: formData.area });
    }
  };

  return (
    <div className="agent-mgmt-container">
      <div className="settings-header">
        <div>
          <h2>Gestión de Agentes</h2>
          <p>Crea y administra las cuentas de tu equipo de trabajo.</p>
        </div>
        <button className="btn-save" onClick={() => setCreando(true)}>
          <UserPlus size={18} style={{ marginRight: '8px' }} />
          Nuevo Agente
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#667781' }}>Cargando agentes...</div>
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

      {/* Modal de creación de agente (con permisos pre-cargados según rol) */}
      {creando && (
        <div className="agent-edit-overlay" onClick={() => setCreando(false)}>
          <div className="agent-edit-modal agent-edit-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="agent-edit-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={16} color="#dc2626" />
                <div>
                  <h3>Nuevo Agente</h3>
                  <p>Los permisos se pre-cargan según el rol elegido</p>
                </div>
              </div>
              <button className="agent-edit-close" onClick={() => setCreando(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="agent-edit-modal-body">
              <AgentForm
                onSubmit={crearAgente}
                onClose={() => setCreando(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición con tabs Datos / Permisos */}
      {editandoAgente && (
        <div className="agent-edit-overlay" onClick={handleCerrarEdicion}>
          <div className="agent-edit-modal agent-edit-modal--wide" onClick={e => e.stopPropagation()}>

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

            {/* Tabs */}
            <div className="agent-edit-tabs">
              <button
                className={`agent-edit-tab${tabActivo === 'datos' ? ' agent-edit-tab--active' : ''}`}
                onClick={() => setTabActivo('datos')}
              >
                <Edit2 size={14} /> Datos
              </button>
              <button
                className={`agent-edit-tab${tabActivo === 'permisos' ? ' agent-edit-tab--active' : ''}`}
                onClick={() => setTabActivo('permisos')}
              >
                <Shield size={14} /> Permisos
              </button>
            </div>

            <div className="agent-edit-modal-body">
              {tabActivo === 'datos' && (
                <AgentForm
                  agente={editandoAgente}
                  onSubmit={handleGuardarEdicion}
                  onClose={handleCerrarEdicion}
                />
              )}
              {tabActivo === 'permisos' && (
                <PermisosEditor agenteId={editandoAgente.id} agente={editandoAgente} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentManagementView;
