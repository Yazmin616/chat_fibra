/**
 * @file TopBar.js
 * @description Barra superior del CRM.
 *
 * Responsabilidades:
 *   - Botón para colapsar/expandir el sidebar.
 *   - Selector de empresa activa (multi-tenant).
 *   - Perfil del agente autenticado (nombre y rol).
 *   - Acceso al manual de usuario.
 *
 * Uso:
 *   <TopBar
 *     sidebarVisible={sidebarVisible}
 *     setSidebarVisible={setSidebarVisible}
 *     empresaId={empresaId}
 *     setEmpresaId={setEmpresaId}
 *     user={user}
 *   />
 */

import React from 'react';
import { Menu, User, BookOpen, ChevronDown, Building2 } from 'lucide-react';

/**
 * @param {object}   props
 * @param {boolean}  props.sidebarVisible    - Estado actual del sidebar.
 * @param {Function} props.setSidebarVisible - Setter para colapsar/expandir el sidebar.
 * @param {string}   props.empresaId         - ID de la empresa seleccionada.
 * @param {Function} props.setEmpresaId      - Setter para cambiar la empresa activa.
 * @param {{ nombre: string, rol: string }} props.user - Agente autenticado.
 */
const TopBar = ({ sidebarVisible, setSidebarVisible, empresaId, setEmpresaId, user }) => {
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
        <button className="manual-btn">
          <BookOpen size={16} style={{ marginRight: '5px' }} />
          Manual de usuario
        </button>
        <div className="user-profile">
          <div className="user-avatar" style={{ backgroundColor: '#dc2626' }}>
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
