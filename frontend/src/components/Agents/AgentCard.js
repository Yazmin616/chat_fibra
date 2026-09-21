import React from 'react';
import { Trash2, Edit2, Shield, User, Mail, Briefcase, Clock, Crown, Key } from 'lucide-react';
import { resolveAvatar } from '../../services/api';
import { getPresenciaInfo } from '../../utils/presenceHelper';

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
 * @param {object}   props.agente          - Datos del agente.
 * @param {object}   props.currentUser     - Usuario actualmente logueado.
 * @param {Function} props.onEditar        - Callback para editar (recibe el agente).
 * @param {Function} props.onEliminar      - Callback para eliminar (recibe el id).
 * @param {Function} props.onResetPassword - Callback para generar contraseña temporal.
 */
const AgentCard = ({ agente, currentUser, onEditar, onEliminar, onResetPassword }) => {
  const handleEliminar = () => {
    if (window.confirm('¿Estás seguro de eliminar a este agente? Sus chats quedarán sin asignar.')) {
      onEliminar(agente.id);
    }
  };

  const inicial = agente.nombre?.charAt(0)?.toUpperCase() || '?';

  // Si es el usuario logueado en esta sesión, sincronizar con su presencia en tiempo real
  const esUsuarioActual = currentUser && Number(currentUser.id) === Number(agente.id);
  const estadoPresenciaEfectivo = esUsuarioActual
    ? (localStorage.getItem('agente_estado_presencia') || currentUser.estado_presencia || agente.estado_presencia || 'disponible')
    : (agente.estado_presencia || 'disponible');

  const estaOnlineEfectivo = esUsuarioActual ? true : Boolean(agente.esta_online);

  const presencia = getPresenciaInfo({
    ...agente,
    esta_online: estaOnlineEfectivo,
    estado_presencia: estadoPresenciaEfectivo
  });

  return (
    <div className="agent-compact-row">
      {/* 1. Avatar Column */}
      <div className="agent-row-avatar-wrapper">
        <div className="agent-row-avatar">
          {agente.foto_perfil ? (
            <img
              src={resolveAvatar(agente.foto_perfil)}
              alt=""
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextElementSibling) {
                  e.target.nextElementSibling.style.display = 'inline';
                }
              }}
            />
          ) : null}
          <span
            className="agent-row-inicial"
            style={{ display: agente.foto_perfil ? 'none' : 'inline' }}
          >
            {inicial}
          </span>
        </div>
        <div 
          className={`agent-row-status-dot ${presencia.estaOnline ? 'online' : 'offline'} ${presencia.id || ''}`}
          style={{
            backgroundColor: presencia.color,
            boxShadow: presencia.estaOnline ? `0 0 6px ${presencia.color}90` : 'none'
          }}
          title={`Estado: ${presencia.labelConEstado || presencia.label}`}
        />
      </div>

      {/* 2. Main Info Column */}
      <div className="agent-row-info">
        <div className="agent-row-name-line">
          <h3>{agente.nombre}</h3>

          {agente.usuario && (
            <span style={{ 
              fontSize: '11.5px', fontWeight: 600, color: '#4f46e5', 
              backgroundColor: '#eef2ff', padding: '2px 7px', borderRadius: '5px',
              fontFamily: 'monospace'
            }}>
              @{agente.usuario}
            </span>
          )}
          
          {/* Badge de Estado de Presencia */}
          <span 
            className="agent-row-presence-badge"
            style={{
              backgroundColor: presencia.bg,
              color: presencia.textDark,
              borderColor: presencia.border ? `${presencia.border}50` : '#e2e8f0',
            }}
          >
            <span 
              className="agent-row-presence-badge-dot"
              style={{ backgroundColor: presencia.color }}
            />
            {presencia.estaOnline ? presencia.label : 'Desconectado'}
          </span>

          <span className={`agent-row-rol-tag ${agente.rol === 'admin' ? 'admin' : ''}`}>
            {agente.rol === 'admin' && <Shield size={10} style={{ marginRight: '3px' }} />}
            {agente.rol}
          </span>

          {agente.es_coordinador && (
            <span className="agent-row-coord-tag">
              <Crown size={10} style={{ marginRight: '3px' }} /> Coordinador
            </span>
          )}

          {agente.debe_cambiar_password && (
            <span style={{ 
              fontSize: '11px', fontWeight: 600, color: '#b45309', 
              backgroundColor: '#fef3c7', border: '1px solid #fde68a',
              padding: '2px 7px', borderRadius: '5px' 
            }}>
              Cambio pendiente
            </span>
          )}
        </div>
        
        <div className="agent-row-details">
          {agente.email ? (
            <span className="agent-row-detail-item">
              <Mail size={12} />
              {agente.email}
            </span>
          ) : (
            <span className="agent-row-detail-item" style={{ color: '#94a3b8' }}>
              <User size={12} />
              Sin correo registrado
            </span>
          )}
          <span className="agent-row-detail-item">
            <Briefcase size={12} />
            {agente.area}
          </span>
          {agente.coordinador_nombre && (
            <span className="agent-row-detail-item" style={{ color: '#64748b' }}>
              <Crown size={11} style={{ color: '#f59e0b' }} />
              Coord: {agente.coordinador_nombre}
            </span>
          )}
          <span 
            className="agent-row-detail-item" 
            style={{ 
              color: presencia.estaOnline ? (presencia.color === '#ef4444' ? '#dc2626' : (presencia.color === '#10b981' ? '#059669' : presencia.color)) : '#94a3b8',
              fontWeight: presencia.estaOnline ? '600' : 'normal'
            }}
          >
            <Clock size={12} />
            {presencia.estaOnline 
              ? (presencia.id === 'disponible' ? 'Disponible ahora' : presencia.label) 
              : formatLastSeen(agente.last_seen)}
          </span>
        </div>
      </div>

      {/* 3. Actions Column */}
      <div className="agent-row-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {(currentUser?.rol === 'admin' || currentUser?.rol === 'ti' || currentUser?.es_coordinador) && onResetPassword && (
          <button 
            type="button"
            className="reset-agent-row-btn" 
            onClick={() => onResetPassword(agente)} 
            title="Generar contraseña temporal para este usuario"
            style={{
              background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
              borderRadius: '6px', padding: '5px 9px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600
            }}
          >
            <Key size={13} />
            <span>Clave temporal</span>
          </button>
        )}
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
