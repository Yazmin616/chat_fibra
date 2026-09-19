import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, MessageCircle, MessagesSquare, Settings, Users,
  LogOut, Shield, AlertTriangle, Tag, FileText, GitBranch, BarChart2, ClipboardList, Megaphone, Wrench
} from 'lucide-react';
import { ESTADOS_PRESENCIA } from '../../utils/presenceHelper';

const Sidebar = ({
  visible, currentView, setView, user, onLogout,
  totalNoLeidos = 0, totalChatInterno = 0, totalInfracciones = 0,
  hasModulo = () => true,  // fallback: muestra todo si no hay permisos aún
  esCoordinador = false,
}) => {
  const [estadoPresencia, setEstadoPresencia] = useState(
    () => localStorage.getItem('agente_estado_presencia') || user?.estado_presencia || 'disponible'
  );

  useEffect(() => {
    const handlePresencia = (e) => {
      if (e.detail && (!e.detail.id || Number(e.detail.id) === Number(user?.id))) {
        if (e.detail.estado_presencia) {
          setEstadoPresencia(e.detail.estado_presencia);
        }
      }
    };
    window.addEventListener('sistema:presencia_cambiada', handlePresencia);
    return () => window.removeEventListener('sistema:presencia_cambiada', handlePresencia);
  }, [user?.id]);

  if (!visible) return null;

  const estadoObj = ESTADOS_PRESENCIA[estadoPresencia] || ESTADOS_PRESENCIA.disponible;
  const esAdmin = user?.rol === 'admin';

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
        {item('dashboard',     'dashboard',         <LayoutDashboard size={20} />, esAdmin ? 'Dashboard General' : 'Dashboard Propio')}
        {item('comunicados',   'comunicados',       <Megaphone size={20} />,       'Avisos y Mural')}
        {item('nps',           'nps',               <BarChart2 size={20} />,       esCoordinador ? 'Dashboard de mi Staff' : 'Evaluación Staff')}
        {item('soluciones',    'soluciones',         <ClipboardList size={20} />,   esAdmin ? 'Soluciones Globales' : (esCoordinador ? 'Soluciones de mi Staff' : 'Mis Soluciones'))}
        {item('chat_interno',  'chat-interno',      <MessagesSquare size={20} />, 'Chat Interno',  totalChatInterno)}
        {item('chat',          'chat',              <MessageCircle size={20} />,  'Chat Clientes', totalNoLeidos)}
        {item('contactos',     'contactos',         <Users size={20} />,          'Contactos')}
        {item('infracciones',  'infracciones',      <AlertTriangle size={20} />,  'Infracciones',      totalInfracciones)}
        {item('etiquetas',     'etiquetas',         <Tag size={20} />,            'Etiquetas')}
        {item('notas_cierre',  'categorias-cierre', <FileText size={20} />,       'Notas de Cierre')}
        {item('flujo_bot',     'flow-editor',       <GitBranch size={20} />,      'Flujo del Bot')}
        {item('usuarios',      'agents',            <Users size={20} />,          'Usuarios / Agentes')}
        {item('equipos',       'equipos',           <Users size={20} />,          esCoordinador ? 'Mi Equipo' : 'Equipos')}
        {/* Soporte del Sistema (Tickets) — accesible para todos los usuarios */}
        {item('tickets',       'tickets',           <Wrench size={20} />,         'Soporte del Sistema')}
        {item('configuracion', 'config',            <Settings size={20} />,       'Configuración')}
      </div>

      <div className="sidebar-footer">
        <div className="user-info-mini">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <Shield size={14} color="#dc2626" />
            <strong style={{ color: '#fff' }}>{user?.nombre}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ textTransform: 'capitalize', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
              {user?.rol} • {user?.area}
              {esCoordinador && ' • Coordinador'}
            </span>
            <span
              className="sidebar-presence-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '1px 7px',
                borderRadius: '10px',
                background: `${estadoObj.color}25`,
                border: `1px solid ${estadoObj.color}60`,
                color: estadoObj.color,
                fontSize: '0.68rem',
                fontWeight: 600,
                lineHeight: '14px'
              }}
              title={`Estado de presencia: ${estadoObj.label} (${estadoObj.desc})`}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: estadoObj.color }} />
              {estadoObj.label}
            </span>
          </div>
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
