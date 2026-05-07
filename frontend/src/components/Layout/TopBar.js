import React from 'react';
import { Menu, User, BookOpen, ChevronDown, Building2 } from 'lucide-react';

const TopBar = ({ sidebarVisible, setSidebarVisible, empresaId, setEmpresaId, user }) => {
  return (
    <div className="top-bar">
      <div className="top-left">
        <button className="icon-btn" onClick={() => setSidebarVisible(!sidebarVisible)}>
          <Menu size={20} />
        </button>
        
        <div className="tenant-selector">
          <Building2 size={18} color="#00a884" />
          <select 
            value={empresaId} 
            onChange={(e) => setEmpresaId(e.target.value)}
            className="company-select"
          >
            <option value="todas">Todas las empresas</option>
            <option value="fibratec">Fibratec</option>
            <option value="compusemmm">Compusemmm de México</option>
          </select>
        </div>
      </div>

      <div className="top-right">
        <button className="manual-btn">
          <BookOpen size={16} style={{ marginRight: '5px' }} />
          Manual de usuario
        </button>
        <div className="user-profile">
          <div className="user-avatar" style={{ backgroundColor: user?.rol === 'admin' ? '#00a884' : '#53bdeb' }}>
            <User size={18} color="#fff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="user-name">{user?.nombre || 'Agente'}</span>
            <span style={{ fontSize: '10px', color: '#667781', textTransform: 'uppercase' }}>{user?.rol}</span>
          </div>
          <ChevronDown size={14} color="#54656f" />
        </div>
      </div>
    </div>
  );
};

export default TopBar;
