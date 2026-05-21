import React from 'react';
import { Trash2, Edit2, Shield, User, Mail, Briefcase, Power, Clock } from 'lucide-react';

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

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className={`online-indicator ${agente.esta_online ? 'online' : 'offline'}`} />
        {agente.rol === 'admin'
          ? <Shield size={16} color="#dc2626" />
          : <User   size={16} color="#54656f" />
        }
        <span className="agent-rol-tag">{agente.rol}</span>
      </div>

      <div className="agent-card-body">
        <h3>{agente.nombre}</h3>
        <div className="agent-detail">
          <Mail size={14} />
          <span>{agente.email}</span>
        </div>
        <div className="agent-detail">
          <Briefcase size={14} />
          <span>{agente.area}</span>
        </div>
        <div className="agent-detail" style={{ color: agente.esta_online ? '#dc2626' : '#aebac1' }}>
          <Clock size={14} />
          <span>{agente.esta_online ? 'Activo ahora' : formatLastSeen(agente.last_seen)}</span>
        </div>
      </div>

      <div className="agent-card-footer">
        <div className="status-badge">
          <Power size={12} /> {agente.esta_online ? 'En línea' : 'Desconectado'}
        </div>
        <div className="agent-card-actions">
          <button className="edit-agent-btn" onClick={() => onEditar(agente)} title="Editar agente">
            <Edit2 size={15} />
          </button>
          <button className="delete-agent-btn" onClick={handleEliminar} title="Eliminar agente">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
