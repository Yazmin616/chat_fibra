import React from 'react';
import { Menu, User, Box } from 'lucide-react';

const TopBar = ({ sidebarVisible, setSidebarVisible }) => (
  <div className="top-bar">
    <div className="top-left">
      <button className="icon-btn" onClick={() => setSidebarVisible(!sidebarVisible)}>
        <Menu size={24} />
      </button>
    </div>
    <div className="top-right">
      <button className="manual-btn">
        <Box size={16} style={{ marginRight: '8px' }} />
        Manual de usuario
      </button>
      <div className="user-profile">
        <div className="user-avatar">
          <User size={20} />
        </div>
        <span className="user-name">Agente Fibratec</span>
      </div>
    </div>
  </div>
);

export default TopBar;
