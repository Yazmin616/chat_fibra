import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  MessageCircle, 
  Settings 
} from 'lucide-react';

const Sidebar = ({ visible, currentView, setView }) => (
  <div className={`sidebar ${visible ? 'open' : 'closed'}`}>
    <div className="logo-container">
      <img src="https://fibratec.mx/wp-content/uploads/2021/03/logo-fibratec.png" alt="Fibratec" className="logo-img" />
    </div>
    
    <div className="menu-section">
      <p className="menu-title">{visible ? 'CRM Y CHATBOT' : ''}</p>
      <div className={`menu-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
        <LayoutDashboard size={20} className="icon" /> {visible && <span>Dashboard</span>}
      </div>
      <div className={`menu-item ${currentView === 'contactos' ? 'active' : ''}`} onClick={() => setView('contactos')}>
        <Users size={20} className="icon" /> {visible && <span>Contactos</span>}
      </div>
      <div className={`menu-item ${currentView === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
        <MessageCircle size={20} className="icon" /> {visible && <span>Chat</span>}
      </div>
      <div className={`menu-item ${currentView === 'config' ? 'active' : ''}`} onClick={() => setView('config')}>
        <Settings size={20} className="icon" /> {visible && <span>Configuración</span>}
      </div>
    </div>
  </div>
);

export default Sidebar;
