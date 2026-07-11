import React from 'react';
import { Trash2, Edit2, Shield, User, Mail, Briefcase, Clock, Crown } from 'lucide-react';
import { resolveAvatar } from '../../services/api';

function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Nunca conectado';
  const diff = Math.floor((Date.now() - new Date(lastSeen)) / 1000);
  if (diff < 60)    return 'Hace menos de 1 min';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} días`;
}

/**
 * @param {object}   props
 * @param {object}   props.agente     - Datos del agente.
 * @param {Function} props.onEditar   - Callback para editar (recibe el agente).
 * @param {Function} props.onEliminar - Callback para eliminar (recibe el id).
 */
const AgentCard = ({ agente, onEditar, onEliminar }) => {
  const handleEliminar = () => {
    if (window.confirm('¿Estás seguro de eliminar a este agente? Sus chats quedarán sin asignar.')) {
      onEliminar(agente.id);
    }
  };

  const inicial = agente.nombre?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="agent-compact-row">
      {/* 1. Avatar Column */}
      <div className="agent-row-avatar-wrapper">
        <div className="agent-row-avatar">
          {agente.foto_perfil ? (
            <img src={resolveAvatar(agente.foto_perfil)} alt={agente.nombre} />
          ) : (
            <span className="agent-row-inicial">{inicial}</span>
          )}
        </div>
        <div className={`agent-row-status-dot ${agente.esta_online ? 'online' : 'offline'}`} />
      </div>

      {/* 2. Main Info Column */}
      <div className="agent-row-info">
        <div className="agent-row-name-line">
          <h3>{agente.nombre}</h3>
          
          <span className={`agent-row-rol-tag ${agente.rol === 'admin' ? 'admin' : ''}`}>
            {agente.rol === 'admin' && <Shield size={10} style={{ marginRight: '3px' }} />}
            {agente.rol}
          </span>

          {agente.es_coordinador && (
            <span className="agent-row-coord-tag">
              <Crown size={10} style={{ marginRight: '3px' }} /> Coordinador
            </span>
          )}
        </div>
        
        <div className="agent-row-details">
          <span className="agent-row-detail-item">
            <Mail size={12} />
            {agente.email}
          </span>
          <span className="agent-row-detail-item">
            <Briefcase size={12} />
            {agente.area}
          </span>
          <span className="agent-row-detail-item" style={{ color: agente.esta_online ? '#dc2626' : '#94a3b8' }}>
            <Clock size={12} />
            {agente.esta_online ? 'Activo ahora' : formatLastSeen(agente.last_seen)}
          </span>
        </div>
      </div>

      {/* 3. Actions Column */}
      <div className="agent-row-actions">
        <button className="edit-agent-row-btn" onClick={() => onEditar(agente)} title="Editar agente">
          <Edit2 size={14} />
        </button>
        <button className="delete-agent-row-btn" onClick={handleEliminar} title="Eliminar agente">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default AgentCard;
