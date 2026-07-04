import React, { useRef, useState } from 'react';
import { Menu, User, ChevronDown, Building2, Camera, Moon, Sun } from 'lucide-react';
import { resolveAvatar, apiService } from '../../services/api';

const TopBar = ({ sidebarVisible, setSidebarVisible, empresaId, setEmpresaId, user, darkMode, setDarkMode }) => {
  const [subiendo, setSubiendo] = useState(false);
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
        <button
          className="icon-btn dark-toggle-btn"
          onClick={() => setDarkMode(d => !d)}
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="user-profile">
          <div
            className={`user-avatar topbar-avatar${subiendo ? ' uploading' : ''}`}
            style={{ backgroundColor: '#dc2626' }}
            onClick={() => !subiendo && fotoRef.current?.click()}
            title="Cambiar foto de perfil"
          >
            <input
              ref={fotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFotoChange}
            />
            {user?.foto_perfil
              ? <img src={resolveAvatar(user.foto_perfil)} alt={user.nombre} />
              : <User size={18} color="#fff" />
            }
            <div className="topbar-avatar-overlay">
              {subiendo
                ? <span className="agent-photo-spinner" />
                : <Camera size={10} color="#fff" />
              }
            </div>
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
