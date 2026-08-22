import React, { useRef, useState, useEffect } from 'react';
import { 
  Menu, User, ChevronDown, Building2, Camera, Moon, Sun, LogOut, Bell,
  CheckCircle2, Users, AlertCircle, Coffee, Clock, Check
} from 'lucide-react';
import { resolveAvatar, apiService } from '../../services/api';
import NotificationDropdown from '../Notifications/NotificationDropdown';

const TopBar = ({
  sidebarVisible,
  setSidebarVisible,
  empresaId,
  setEmpresaId,
  user,
  socket,
  darkMode,
  setDarkMode,
  currentView,
  onLogout,
  notificaciones = [],
  unreadCount = 0,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onEliminarNotificacion,
  onLimpiarTodas,
  onSelectNotificacion,
}) => {
  const [subiendo, setSubiendo] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [estadoPresencia, setEstadoPresencia] = useState(
    () => localStorage.getItem('agente_estado_presencia') || user?.estado_presencia || 'disponible'
  );
  const fotoRef = useRef(null);

  const ESTADOS = [
    { id: 'disponible', label: 'Disponible', icon: CheckCircle2, color: '#10b981', desc: 'Atendiendo normalmente' },
    { id: 'reunion',    label: 'En reunión', icon: Users,        color: '#f59e0b', desc: 'En junta o llamada' },
    { id: 'ocupado',    label: 'No molestar', icon: AlertCircle,  color: '#ef4444', desc: 'Tareas concentradas' },
    { id: 'comida',     label: 'En comida',  icon: Coffee,       color: '#d97706', desc: 'Almuerzo / Break' },
    { id: 'ausente',    label: 'Ausente',    icon: Clock,        color: '#64748b', desc: 'Fuera del lugar' },
  ];

  const estadoActualObj = ESTADOS.find(e => e.id === estadoPresencia) || ESTADOS[0];

  const handleCambiarEstado = (nuevoId) => {
    setEstadoPresencia(nuevoId);
    localStorage.setItem('agente_estado_presencia', nuevoId);
    if (socket && user?.id) {
      socket.emit('agente:cambiar_presencia', { estado: nuevoId, agenteId: user.id });
    }
  };

  // Re-emitir presencia al conectar el socket o cambiar de usuario
  useEffect(() => {
    if (!socket || !user?.id) return;
    const st = localStorage.getItem('agente_estado_presencia') || user.estado_presencia || 'disponible';
    socket.emit('agente:cambiar_presencia', { estado: st, agenteId: user.id });
  }, [socket, user]);

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setSubiendo(true);
    try {
      const result = await apiService.subirFotoPerfil(user.id, file);
      window.dispatchEvent(new CustomEvent('agente:foto-actualizada', {
        detail: { id: user.id, foto_perfil: result.foto_perfil + '?v=' + Date.now() },
      }));
    } catch (_) {
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  const handleLogoutClick = () => {
    onLogout();
  };

  return (
    <div className="top-bar">
      <div className="top-left">
        <button className="icon-btn" onClick={() => setSidebarVisible(!sidebarVisible)}>
          <Menu size={20} />
        </button>

        <div className="tenant-selector">
          <Building2 size={18} color="#dc2626" />
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

      <div className="top-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {currentView === 'chat' && (
          <button
            className="icon-btn dark-toggle-btn"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        {/* Campana de Notificaciones Estilo Facebook */}
        <div className="fb-topbar-btn-wrap">
          <button
            className={`fb-bell-btn ${notifOpen ? 'active' : ''}`}
            onClick={() => { setNotifOpen(prev => !prev); setDropdownOpen(false); }}
            title="Notificaciones"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="fb-badge-count">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => setNotifOpen(false)}
              />
              <NotificationDropdown
                notificaciones={notificaciones}
                onClose={() => setNotifOpen(false)}
                onMarcarLeida={onMarcarLeida}
                onMarcarTodasLeidas={onMarcarTodasLeidas}
                onEliminarNotificacion={onEliminarNotificacion}
                onLimpiarTodas={onLimpiarTodas}
                onSelectNotificacion={(notif) => {
                  setNotifOpen(false);
                  if (onSelectNotificacion) onSelectNotificacion(notif);
                }}
              />
            </>
          )}
        </div>

        {/* Menú de Perfil de Usuario con Estado de Presencia */}
        <div className="topbar-user-menu">
          <div className="user-profile" onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); }} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="user-avatar" style={{ backgroundColor: '#dc2626', position: 'relative' }}>
              {user?.foto_perfil ? (
                <img src={resolveAvatar(user.foto_perfil)} alt={user.nombre} />
              ) : (
                <User size={18} color="#fff" />
              )}
              <span 
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: estadoActualObj.color,
                  border: '2px solid #fff',
                  boxShadow: '0 0 2px rgba(0,0,0,0.3)'
                }}
                title={`Estado: ${estadoActualObj.label}`}
              />
            </div>
            <div className="user-info-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="user-name">{user?.nombre || 'Agente'}</span>
              </div>
              <span className="user-role-label">{user?.rol}</span>
            </div>
            <ChevronDown size={14} color="#54656f" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </div>

          {dropdownOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                onClick={() => setDropdownOpen(false)} 
              />
              <div className="topbar-dropdown-menu" style={{ zIndex: 999, minWidth: '220px' }}>
                <div className="topbar-dropdown-header">
                  <strong>{user?.nombre}</strong>
                  <span>{user?.email}</span>
                </div>

                {/* Selector de Presencia / Disponibilidad */}
                <div style={{ padding: '6px 12px 4px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Estado de Presencia
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 4px' }}>
                  {ESTADOS.map(est => {
                    const isSelected = est.id === estadoPresencia;
                    const IconComp = est.icon;
                    return (
                      <button
                        key={est.id}
                        onClick={() => handleCambiarEstado(est.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: isSelected ? '#f1f5f9' : 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? '#0f172a' : '#475569',
                          textAlign: 'left',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: `${est.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: est.color,
                          flexShrink: 0
                        }}>
                          <IconComp size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div>{est.label}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1 }}>{est.desc}</div>
                        </div>
                        {isSelected && <Check size={14} color="#10b981" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>

                <div className="topbar-dropdown-divider" />
                
                <button 
                  className="topbar-dropdown-item" 
                  onClick={() => { setDropdownOpen(false); !subiendo && fotoRef.current?.click(); }}
                  disabled={subiendo}
                >
                  <Camera size={14} /> 
                  {subiendo ? 'Subiendo...' : 'Cambiar foto'}
                </button>

                <div className="topbar-dropdown-divider" />

                <button className="topbar-dropdown-item logout-btn" onClick={() => { setDropdownOpen(false); handleLogoutClick(); }}>
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>

        <input
          ref={fotoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFotoChange}
        />
      </div>
    </div>
  );
};

export default TopBar;
