import React, { useRef, useState, useEffect } from 'react';
import { 
  Menu, User, ChevronDown, Building2, Camera, Moon, Sun, LogOut, Bell,
  Check
} from 'lucide-react';
import { resolveAvatar, apiService } from '../../services/api';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import { LISTA_ESTADOS_PRESENCIA, ESTADOS_PRESENCIA } from '../../utils/presenceHelper';

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

  const ESTADOS = LISTA_ESTADOS_PRESENCIA;
  const estadoActualObj = ESTADOS_PRESENCIA[estadoPresencia] || ESTADOS_PRESENCIA.disponible;

  const handleCambiarEstado = (nuevoId) => {
    setEstadoPresencia(nuevoId);
    localStorage.setItem('agente_estado_presencia', nuevoId);
    if (socket && user?.id) {
      socket.emit('agente:cambiar_presencia', { estado: nuevoId, agenteId: user.id });
    }
    try {
      window.dispatchEvent(new CustomEvent('sistema:presencia_cambiada', {
        detail: { id: Number(user?.id), estado_presencia: nuevoId }
      }));
    } catch (_) {}
  };

  // Sincronizar presencia si cambia desde otro componente
  useEffect(() => {
    const handlePresenciaEvt = (e) => {
      if (e.detail && (!e.detail.id || Number(e.detail.id) === Number(user?.id))) {
        if (e.detail.estado_presencia) {
          setEstadoPresencia(e.detail.estado_presencia);
          localStorage.setItem('agente_estado_presencia', e.detail.estado_presencia);
        }
      }
    };
    window.addEventListener('sistema:presencia_cambiada', handlePresenciaEvt);
    return () => window.removeEventListener('sistema:presencia_cambiada', handlePresenciaEvt);
  }, [user?.id]);

  // Re-emitir presencia al conectar el socket o cambiar de usuario
  useEffect(() => {
    if (!socket || !user?.id) return;
    const st = localStorage.getItem('agente_estado_presencia') || user.estado_presencia || 'disponible';
    socket.emit('agente:cambiar_presencia', { estado: st, agenteId: user.id });
  }, [socket, user]);

  // Sincronizar tema oscuro si cambia desde otra vista o componente
  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail && typeof e.detail.isDark === 'boolean' && setDarkMode) {
        setDarkMode(e.detail.isDark);
      }
    };
    window.addEventListener('sistema:theme_changed', handleThemeChange);
    return () => window.removeEventListener('sistema:theme_changed', handleThemeChange);
  }, [setDarkMode]);

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
        <button
          className="icon-btn dark-toggle-btn"
          onClick={() => {
            const next = !darkMode;
            try {
              localStorage.setItem('app_theme', next ? 'dark' : 'light');
            } catch (e) {}
            if (setDarkMode) {
              setDarkMode(next);
            }
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('sistema:theme_changed', { detail: { isDark: next } }));
            }, 0);
          }}
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

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
            <div className="topbar-user-avatar-wrap" style={{ position: 'relative', flexShrink: 0 }}>
              <div className="user-avatar" style={{ backgroundColor: '#dc2626' }}>
                {user?.foto_perfil ? (
                  <img src={resolveAvatar(user.foto_perfil)} alt={user.nombre} />
                ) : (
                  <User size={18} color="#fff" />
                )}
              </div>
              <span 
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  backgroundColor: estadoActualObj.color,
                  border: '2px solid #fff',
                  boxShadow: `0 0 0 1px ${estadoActualObj.border}50, 0 1px 3px rgba(0,0,0,0.35)`,
                  zIndex: 2
                }}
                title={`Estado: ${estadoActualObj.label} (${estadoActualObj.desc})`}
              />
            </div>
            <div className="user-info-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="user-name">{user?.nombre || 'Agente'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="user-role-label">{user?.rol}</span>
                <span
                  className="topbar-presence-pill"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    background: `${estadoActualObj.color}18`,
                    border: `1px solid ${estadoActualObj.color}45`,
                    color: estadoActualObj.color,
                    fontSize: '0.69rem',
                    fontWeight: 600,
                    lineHeight: '14px',
                    letterSpacing: '0.01em'
                  }}
                  title={`Estado de presencia: ${estadoActualObj.label} - ${estadoActualObj.desc}`}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: estadoActualObj.color }} />
                  {estadoActualObj.label}
                </span>
              </div>
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
                <div className="topbar-presence-section-title">
                  Estado de Presencia
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 4px' }}>
                  {ESTADOS.map(est => {
                    const isSelected = est.id === estadoPresencia;
                    const IconComp = est.icon;
                    return (
                      <button
                        key={est.id}
                        type="button"
                        onClick={() => handleCambiarEstado(est.id)}
                        className={`topbar-presence-btn ${isSelected ? 'selected' : ''}`}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: `${est.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: est.color,
                          flexShrink: 0
                        }}>
                          <IconComp size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="topbar-presence-label">{est.label}</div>
                          <div className="topbar-presence-desc">{est.desc}</div>
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
