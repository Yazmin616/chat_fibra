import React, { useRef, useState } from 'react';
import { Menu, User, ChevronDown, Building2, Camera, Moon, Sun, LogOut } from 'lucide-react';
import { resolveAvatar, apiService } from '../../services/api';

const TopBar = ({ sidebarVisible, setSidebarVisible, empresaId, setEmpresaId, user, darkMode, setDarkMode, currentView, onLogout }) => {
  const [subiendo, setSubiendo] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fotoRef = useRef(null);

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
    if (window.confirm('¿Seguro que deseas cerrar la sesión?')) {
      onLogout();
    }
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

      <div className="top-right">
        {currentView === 'chat' && (
          <button
            className="icon-btn dark-toggle-btn"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <div className="topbar-user-menu">
          <div className="user-profile" onClick={() => setDropdownOpen(!dropdownOpen)} style={{ cursor: 'pointer' }}>
            <div className="user-avatar" style={{ backgroundColor: '#dc2626' }}>
              {user?.foto_perfil ? (
                <img src={resolveAvatar(user.foto_perfil)} alt={user.nombre} />
              ) : (
                <User size={18} color="#fff" />
              )}
            </div>
            <div className="user-info-text">
              <span className="user-name">{user?.nombre || 'Agente'}</span>
              <span className="user-role-label">{user?.rol}</span>
            </div>
            <ChevronDown size={14} color="#54656f" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </div>

          {dropdownOpen && (
            <>
              {/* Backdrop transparente para cerrar el dropdown al hacer clic fuera */}
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                onClick={() => setDropdownOpen(false)} 
              />
              <div className="topbar-dropdown-menu" style={{ zIndex: 999 }}>
                <div className="topbar-dropdown-header">
                  <strong>{user?.nombre}</strong>
                  <span>{user?.email}</span>
                </div>
                
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
