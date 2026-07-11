

import React, { useState } from 'react';
import { UserPlus, X, Edit2, Shield, Search } from 'lucide-react';
import { useAgentes }    from '../../hooks/useAgentes';
import AgentForm         from '../Agents/AgentForm';
import AgentCard         from '../Agents/AgentCard';
import PermisosEditor    from '../Agents/PermisosEditor';

const AgentManagementView = ({ user, actualizarUsuario }) => {
  const { agentes, loading, crearAgente, editarAgente, eliminarAgente } = useAgentes();
  const [creando,        setCreando]        = useState(false);
  const [editandoAgente, setEditandoAgente] = useState(null);
  const [tabActivo,      setTabActivo]      = useState('datos'); // 'datos' | 'permisos'

  // Filtros y Buscador
  const [search, setSearch] = useState('');
  const [rolFiltro, setRolFiltro] = useState('todos');
  const [areaFiltro, setAreaFiltro] = useState('todas');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

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

  // Filtrado de la lista de agentes
  const filteredAgentes = agentes.filter(agente => {
    const matchesSearch = 
      (agente.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
      (agente.email || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesRol = rolFiltro === 'todos' || agente.rol === rolFiltro;
    const matchesArea = areaFiltro === 'todas' || agente.area === areaFiltro;
    
    const matchesEstado = 
      estadoFiltro === 'todos' || 
      (estadoFiltro === 'online' && agente.esta_online) || 
      (estadoFiltro === 'offline' && !agente.esta_online);

    return matchesSearch && matchesRol && matchesArea && matchesEstado;
  });

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

      {/* Toolbar con buscador y filtros */}
      <div className="agent-toolbar">
        <div className="agent-search-wrapper">
          <Search size={16} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch('')} 
              style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="agent-filter-select">
          <label>Rol</label>
          <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="asesor">Asesor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <div className="agent-filter-select">
          <label>Área</label>
          <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)}>
            <option value="todas">Todas las áreas</option>
            <option value="General">General</option>
            <option value="Soporte Técnico">Soporte Técnico</option>
            <option value="Ventas">Ventas</option>
            <option value="Cobranza">Cobranza</option>
          </select>
        </div>

        <div className="agent-filter-select">
          <label>Estado</label>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="online">En línea</option>
            <option value="offline">Desconectado</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#667781' }}>Cargando agentes...</div>
      ) : (
        <div className="agent-compact-list">
          {filteredAgentes.map(agente => (
            <AgentCard
              key={agente.id}
              agente={agente}
              onEditar={handleEditar}
              onEliminar={eliminarAgente}
            />
          ))}
          {filteredAgentes.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              No se encontraron agentes que coincidan con los filtros.
            </div>
          )}
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
