import React from 'react';
import { LayoutDashboard, MessageCircle, Settings, Users, LogOut, Shield } from 'lucide-react';

const Sidebar = ({ visible, currentView, setView, user, onLogout }) => {
  if (!visible) return null;

  return (
    <div className={`sidebar ${visible ? '' : 'closed'}`}>
      <div className="logo-container">
        <h2 style={{ color: '#00a884', fontSize: '20px' }}>CRM Fibratec</h2>
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
        >
          <MessageCircle size={20} />
          <span>Chat</span>
        </div>

        <div 
          className={`menu-item ${currentView === 'contactos' ? 'active' : ''}`}
          onClick={() => setView('contactos')}
        >
          <Users size={20} />
          <span>Contactos</span>
        </div>

        {/* Solo Admin ve Gestión de Usuarios */}
        {user?.rol === 'admin' && (
          <div 
            className={`menu-item ${currentView === 'agents' ? 'active' : ''}`}
            onClick={() => setView('agents')}
          >
            <Users size={20} />
            <span>Usuarios / Agentes</span>
          </div>
        )}

        {/* Solo Admin ve configuración */}
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

      <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid #202c33' }}>
        <div className="user-info-mini" style={{ color: '#aebac1', fontSize: '12px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Shield size={14} color="#00a884" />
            <strong style={{ color: '#fff' }}>{user?.nombre}</strong>
          </div>
          <span style={{ textTransform: 'capitalize' }}>{user?.rol} - {user?.area}</span>
        </div>
        
        <div className="menu-item logout" onClick={onLogout} style={{ color: '#e74c3c' }}>
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
