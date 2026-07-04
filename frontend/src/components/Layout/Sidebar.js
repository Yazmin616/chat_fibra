import React from 'react';
import {
  LayoutDashboard, MessageCircle, Settings, Users,
  LogOut, Shield, AlertTriangle, Tag, FileText, GitBranch,
} from 'lucide-react';

const Sidebar = ({
  visible, currentView, setView, user, onLogout,
  totalNoLeidos = 0, totalInfracciones = 0,
  hasModulo = () => true,  // fallback: muestra todo si no hay permisos aún
}) => {
  if (!visible) return null;

  const item = (modulo, view, icon, label, badge) => {
    if (!hasModulo(modulo)) return null;
    return (
      <div
        className={`menu-item ${currentView === view ? 'active' : ''}`}
        onClick={() => setView(view)}
        style={{ position: 'relative' }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {icon}
          {badge > 0 && (
            <span className="sidebar-badge" style={modulo === 'infracciones' ? { background: '#ef4444' } : {}}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span>{label}</span>
      </div>
    );
  };

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
        <img src="/logo-fibratec.png"    alt="Fibratec"    style={{ height: '30px', objectFit: 'contain' }} />
        <img src="/logo-compusemmm.png"  alt="Compusemmm"  style={{ height: '30px', objectFit: 'contain' }} />
      </div>

      <div className="menu-section">
        {item('dashboard',     'dashboard',         <LayoutDashboard size={20} />, 'Dashboard')}
        {item('chat',          'chat',              <MessageCircle size={20} />,  'Chat',              totalNoLeidos)}
        {item('contactos',     'contactos',         <Users size={20} />,          'Contactos')}
        {item('infracciones',  'infracciones',      <AlertTriangle size={20} />,  'Infracciones',      totalInfracciones)}
        {item('etiquetas',     'etiquetas',         <Tag size={20} />,            'Etiquetas')}
        {item('notas_cierre',  'categorias-cierre', <FileText size={20} />,       'Notas de Cierre')}
        {item('flujo_bot',     'flow-editor',       <GitBranch size={20} />,      'Flujo del Bot')}
        {item('usuarios',      'agents',            <Users size={20} />,          'Usuarios / Agentes')}
        {item('configuracion', 'config',            <Settings size={20} />,       'Configuración')}
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
