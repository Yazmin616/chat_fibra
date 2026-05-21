import React from 'react';
import { LayoutDashboard, MessageCircle, Settings, Users, LogOut, Shield, AlertTriangle } from 'lucide-react';

const Sidebar = ({ visible, currentView, setView, user, onLogout, totalNoLeidos = 0, totalInfracciones = 0 }) => {
  if (!visible) return null;

  return (
    <div className="sidebar">
      <div className="logo-container" style={{
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <img src="/logo-fibratec.png" alt="Logo 1" style={{ height: '30px', objectFit: 'contain' }} />
        <img src="/logo-compusemmm.png" alt="Compusemmm" style={{ height: '30px', objectFit: 'contain' }} />
      </div>

      <div className="menu-section">

        <div
          className={`menu-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setView('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </div>

        <div
          className={`menu-item ${currentView === 'chat' ? 'active' : ''}`}
          onClick={() => setView('chat')}
          style={{ position: 'relative' }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <MessageCircle size={20} />
            {totalNoLeidos > 0 && (
              <span className="sidebar-badge">
                {totalNoLeidos > 99 ? '99+' : totalNoLeidos}
              </span>
            )}
          </div>
          <span>Chat</span>
        </div>

        <div
          className={`menu-item ${currentView === 'contactos' ? 'active' : ''}`}
          onClick={() => setView('contactos')}
        >
          <Users size={20} />
          <span>Contactos</span>
        </div>

        {user?.rol === 'admin' && (
          <div
            className={`menu-item ${currentView === 'infracciones' ? 'active' : ''}`}
            onClick={() => setView('infracciones')}
            style={{ position: 'relative' }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              {totalInfracciones > 0 && (
                <span className="sidebar-badge" style={{ background: '#ef4444' }}>
                  {totalInfracciones > 99 ? '99+' : totalInfracciones}
                </span>
              )}
            </div>
            <span>Infracciones</span>
          </div>
        )}

        {user?.rol === 'admin' && (
          <div
            className={`menu-item ${currentView === 'agents' ? 'active' : ''}`}
            onClick={() => setView('agents')}
          >
            <Users size={20} />
            <span>Usuarios / Agentes</span>
          </div>
        )}

        {user?.rol === 'admin' && (
          <div
            className={`menu-item ${currentView === 'config' ? 'active' : ''}`}
            onClick={() => setView('config')}
          >
            <Settings size={20} />
            <span>Configuración</span>
          </div>
        )}

      </div>

      <div className="sidebar-footer">
        <div className="user-info-mini">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Shield size={14} color="#dc2626" />
            <strong style={{ color: '#fff' }}>{user?.nombre}</strong>
          </div>
          <span style={{ textTransform: 'capitalize' }}>{user?.rol} · {user?.area}</span>
        </div>

        <div className="menu-item logout" onClick={onLogout}>
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
