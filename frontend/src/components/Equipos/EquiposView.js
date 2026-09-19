import React, { useState, useEffect, useRef } from 'react';
import { Shield, Users, Check, AlertCircle, Loader2, ChevronDown, X, Crown, Key, Search, ChevronRight } from 'lucide-react';
import { apiService, resolveAvatar } from '../../services/api';
import ResetTemporalModal from '../Agents/ResetTemporalModal';
import '../../styles/equipos.css';

const EquiposView = ({ empresaId, user, isSettingsSection = false }) => {
  const [areas, setAreas] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState({});
  const [agenteParaReset, setAgenteParaReset] = useState(null);
  const [expandedAreaId, setExpandedAreaId] = useState(null);
  const dropdownRef = useRef(null);

  const esAdmin = user?.rol === 'admin';

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [areasData, agentesData] = await Promise.all([
        apiService.getAreasSoluciones(empresaId),
        apiService.getAgentes()
      ]);
      setAreas(Array.isArray(areasData) ? areasData : []);
      setAgentes(Array.isArray(agentesData) ? agentesData : []);
    } catch (err) {
      console.error("Error al cargar datos de equipos:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [empresaId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCoordinator = async (area, coordinatorId) => {
    if (!esAdmin) return;
    setActiveDropdown(null);
    setSearchTerm('');
    const areaId = area.id;

    setSaveStatus(prev => ({ ...prev, [areaId]: 'saving' }));

    try {
      await apiService.updateAreaSolucion(areaId, {
        ...area,
        coordinador_id: coordinatorId
      });

      setSaveStatus(prev => ({ ...prev, [areaId]: 'saved' }));
      const updatedAreas = await apiService.getAreasSoluciones(empresaId);
      setAreas(updatedAreas);

      setTimeout(() => {
        setSaveStatus(prev => {
          const next = { ...prev };
          delete next[areaId];
          return next;
        });
      }, 3000);
    } catch (err) {
      console.error("Error al asignar coordinador:", err);
      setSaveStatus(prev => ({ ...prev, [areaId]: 'error' }));
      setTimeout(() => {
        setSaveStatus(prev => {
          const next = { ...prev };
          delete next[areaId];
          return next;
        });
      }, 4000);
    }
  };

  const getAreaClass = (nombre) => {
    const nom = (nombre || '').toLowerCase();
    if (nom.includes('soporte')) return 'soporte';
    if (nom.includes('venta')) return 'ventas';
    if (nom.includes('cobranza') || nom.includes('pago')) return 'cobranza';
    return '';
  };

  // Filtrar áreas que coordina el usuario si no es admin
  const misAreasCoordinadas = esAdmin
    ? areas
    : areas.filter(a => a.coordinador_id === user?.id || (user?.area && (a.nombre_area || '').toLowerCase() === user.area.toLowerCase()));

  if (loading && areas.length === 0 && agentes.length === 0) {
    return (
      <div className="equipos-loading" style={{ padding: '60px 0', textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 12px', color: '#dc2626' }} />
        <span style={{ color: '#64748b', fontSize: '14px' }}>Cargando información del equipo...</span>
      </div>
    );
  }

  return (
    <div className={`equipos-container${isSettingsSection ? ' equipos-container--embedded' : ''}`} style={isSettingsSection ? { padding: 0, maxWidth: '100%' } : {}}>
      
      {/* ── ENCABEZADO ──────────────────────────────────────────────────────── */}
      <div className="equipos-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1>
              <Users size={22} style={{ color: '#dc2626' }} />
              {esAdmin ? 'Gestión de Equipos y Coordinaciones' : `Mi Equipo — ${user?.area || 'Coordinación'}`}
            </h1>
            <p>
              {esAdmin
                ? 'Administra los líderes de área y consulta a los miembros de cada equipo para generarles contraseñas temporales.'
                : 'Consulta a los colaboradores de tu área. Si alguien olvida sus credenciales, genera una contraseña temporal de recuperación.'}
            </p>
          </div>

          {/* Buscador de miembros rápido */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                width: '100%',
                boxSizing: 'border-box',
                background: '#fff',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── MODO COORDINADOR: VISTA DIRECTA DE SU EQUIPO ────────────────────── */}
      {!esAdmin ? (
        <div>
          {misAreasCoordinadas.length === 0 ? (
            <div className="equipos-empty-state" style={{ background: '#fff', padding: '36px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <Shield size={40} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
              <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>No se encontró área asignada</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                Tu cuenta no tiene un área o equipo registrado en el sistema. Contacta a un Administrador para asociarte a tu departamento.
              </p>
            </div>
          ) : (
            misAreasCoordinadas.map(area => {
              const miembros = agentes.filter(ag => {
                const matchArea = (ag.area || '').trim().toLowerCase() === (area.nombre_area || '').trim().toLowerCase() ||
                                  (ag.coordinador_id && Number(ag.coordinador_id) === Number(user?.id));
                const matchSearch = !memberSearch || 
                  (ag.nombre || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                  (ag.usuario || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                  (ag.email || '').toLowerCase().includes(memberSearch.toLowerCase());
                return matchArea && matchSearch;
              });

              return (
                <div key={area.id} style={{ marginBottom: '24px' }}>
                  {/* Tarjeta resumen del equipo */}
                  <div style={{
                    background: '#fff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '16px 20px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={`team-icon-box ${getAreaClass(area.nombre_area)}`} style={{ width: '32px', height: '32px' }}>
                          <Shield size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>{area.nombre_area}</strong>
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                            ({miembros.length} colaboradores en tu equipo)
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Crown size={14} style={{ color: '#d97706' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                          Tú eres el Líder / Coordinador
                        </span>
                      </div>
                    </div>

                    {/* Tabla de colaboradores del equipo */}
                    {miembros.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No hay colaboradores en este equipo que coincidan con la búsqueda.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase' }}>Colaborador</th>
                              <th style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase' }}>Usuario Acceso</th>
                              <th style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase' }}>Estado Presencia</th>
                              <th style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', textAlign: 'right' }}>Acción de Recuperación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {miembros.map(miembro => {
                              const esElPropioCoordinador = miembro.id === user?.id;
                              const online = Boolean(miembro.esta_online);

                              return (
                                <tr key={miembro.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  
                                  {/* Colaborador */}
                                  <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: '#f1f5f9', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontWeight: 700, color: '#475569',
                                        fontSize: '13px', overflow: 'hidden', flexShrink: 0
                                      }}>
                                        {miembro.foto_perfil ? (
                                          <img src={resolveAvatar(miembro.foto_perfil)} alt={miembro.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          miembro.nombre.charAt(0).toUpperCase()
                                        )}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                          {miembro.nombre}
                                          {esElPropioCoordinador && (
                                            <span style={{ marginLeft: '6px', fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                              Tú
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                          {miembro.email || (miembro.rol === 'colaborador' ? 'Chat Interno' : 'Asesor')}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Usuario Acceso */}
                                  <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                    <span style={{
                                      fontFamily: 'monospace',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      background: '#f1f5f9',
                                      color: '#334155',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0'
                                    }}>
                                      @{miembro.usuario || 'sin_usuario'}
                                    </span>
                                    {miembro.debe_cambiar_password && (
                                      <div style={{ fontSize: '10.5px', color: '#d97706', marginTop: '3px', fontWeight: 600 }}>
                                        🔑 Cambio pendiente
                                      </div>
                                    )}
                                  </td>

                                  {/* Presencia */}
                                  <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: online ? '#16a34a' : '#64748b',
                                      background: online ? '#f0fdf4' : '#f8fafc',
                                      border: `1px solid ${online ? '#bbf7d0' : '#e2e8f0'}`,
                                      padding: '2px 8px',
                                      borderRadius: '12px'
                                    }}>
                                      <span style={{
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: online ? '#16a34a' : '#94a3b8'
                                      }} />
                                      {online ? 'En línea' : 'Desconectado'}
                                    </span>
                                  </td>

                                  {/* Acción de Recuperación */}
                                  <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right' }}>
                                    {!esElPropioCoordinador ? (
                                      <button
                                        type="button"
                                        onClick={() => setAgenteParaReset(miembro)}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 12px',
                                          background: '#fffbeb',
                                          border: '1px solid #fde68a',
                                          borderRadius: '7px',
                                          color: '#b45309',
                                          fontSize: '12px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                        title="Genera una contraseña temporal para este usuario"
                                      >
                                        <Key size={14} />
                                        <span>Generar Clave Temporal</span>
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                                        Tu cuenta propia
                                      </span>
                                    )}
                                  </td>

                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── MODO ADMINISTRADOR: GESTIÓN GLOBAL DE ÁREAS Y EQUIPOS ──────────── */
        <>
          <div className="equipos-table-wrapper">
            <table className="equipos-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Equipo</th>
                  <th style={{ width: '30%' }}>Líder de Área (Coordinador)</th>
                  <th style={{ width: '38%' }}>Miembros del Equipo</th>
                </tr>
              </thead>
              <tbody>
                {areas.map(area => {
                  const miembros = agentes.filter(ag => {
                    const matchArea = (ag.area || '').trim().toLowerCase() === (area.nombre_area || '').trim().toLowerCase() ||
                                      (ag.coordinador_id && Number(ag.coordinador_id) === Number(area.coordinador_id));
                    const matchSearch = !memberSearch || 
                      (ag.nombre || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                      (ag.usuario || '').toLowerCase().includes(memberSearch.toLowerCase());
                    return matchArea && matchSearch;
                  });

                  const coordinador = agentes.find(ag => ag.id === area.coordinador_id);
                  const status = saveStatus[area.id];
                  const isExpanded = expandedAreaId === area.id;

                  return (
                    <React.Fragment key={area.id}>
                      <tr>
                        {/* Columna 1: Equipo */}
                        <td>
                          <div className={`team-info-cell ${getAreaClass(area.nombre_area)}`}>
                            <div className="team-icon-box">
                              <Shield size={18} />
                            </div>
                            <div className="team-name-wrap">
                              <span className="team-name">{area.nombre_area}</span>
                              <span className="team-desc">{area.descripcion || 'Sin descripción.'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Columna 2: Coordinador con selector */}
                        <td>
                          <div className="coordinador-selector-box">
                            <div 
                              className="coord-dropdown-trigger" 
                              onClick={() => setActiveDropdown(activeDropdown === area.id ? null : area.id)}
                            >
                              <div className="coord-info">
                                {coordinador ? (
                                  <>
                                    <div className="coord-avatar">
                                      {coordinador.foto_perfil ? (
                                        <img src={resolveAvatar(coordinador.foto_perfil)} alt={coordinador.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        coordinador.nombre.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <span className="coord-name">{coordinador.nombre}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="coord-avatar" style={{ background: '#cbd5e1', color: '#64748b' }}>
                                      ?
                                    </div>
                                    <span className="coord-name placeholder">Sin coordinador asignado</span>
                                  </>
                                )}
                              </div>
                              <ChevronDown size={14} style={{ color: '#64748b', marginLeft: 'auto' }} />
                            </div>

                            <div className={`save-status-row-indicator ${status ? 'visible' : ''} ${status === 'error' ? 'error' : ''} ${status === 'saving' ? 'saving' : ''}`}>
                              {status === 'saving' && <Loader2 className="animate-spin" size={10} />}
                              {status === 'saved' && <Check size={10} />}
                              {status === 'error' && <AlertCircle size={10} />}
                            </div>

                            {activeDropdown === area.id && (
                              <div className="coord-dropdown-list" ref={dropdownRef}>
                                <input 
                                  type="text" 
                                  placeholder="Buscar agente..." 
                                  className="coord-search-input"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  autoFocus
                                />
                                
                                <div className="coord-options-scroll">
                                  <div 
                                    className={`coord-option ${!coordinador ? 'selected' : ''}`}
                                    onClick={() => handleSelectCoordinator(area, null)}
                                  >
                                    <div className="coord-option-left">
                                      <div className="coord-avatar" style={{ background: '#e2e8f0', color: '#475569' }}>
                                        <X size={10} />
                                      </div>
                                      <span className="coord-option-name" style={{ fontStyle: 'italic', color: '#64748b' }}>
                                        Ninguno (Remover Líder)
                                      </span>
                                    </div>
                                    {!coordinador && <Check size={12} style={{ color: '#3b82f6' }} />}
                                  </div>

                                  {agentes
                                    .filter(ag => 
                                      ag.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      (ag.usuario && ag.usuario.toLowerCase().includes(searchTerm.toLowerCase()))
                                    )
                                    .map(ag => {
                                      const isSelected = area.coordinador_id === ag.id;
                                      return (
                                        <div 
                                          key={ag.id} 
                                          className={`coord-option ${isSelected ? 'selected' : ''}`}
                                          onClick={() => handleSelectCoordinator(area, ag.id)}
                                        >
                                          <div className="coord-option-left">
                                            <div className="coord-avatar">
                                              {ag.foto_perfil ? (
                                                <img src={resolveAvatar(ag.foto_perfil)} alt={ag.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                              ) : (
                                                ag.nombre.charAt(0).toUpperCase()
                                              )}
                                            </div>
                                            <div>
                                              <div className="coord-option-name">{ag.nombre}</div>
                                              <div className="coord-option-email">@{ag.usuario || ag.email}</div>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {ag.area && <span className="coord-option-area-tag">{ag.area}</span>}
                                            {isSelected && <Check size={12} style={{ color: '#3b82f6' }} />}
                                          </div>
                                        </div>
                                      );
                                    })
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Columna 3: Miembros */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="miembros-stack">
                              {miembros.length === 0 ? (
                                <span className="miembros-empty">Sin asesores</span>
                              ) : (
                                miembros.map(miembro => {
                                  const isCoord = area.coordinador_id === miembro.id;
                                  return (
                                    <div 
                                      key={miembro.id} 
                                      className={`miembro-avatar-stack ${isCoord ? 'es-coordinador' : ''}`} 
                                      data-tooltip={`${miembro.nombre} (@${miembro.usuario}) - Clic para generar clave`}
                                      onClick={() => setAgenteParaReset(miembro)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className="miembro-avatar">
                                        {miembro.foto_perfil ? (
                                          <img src={resolveAvatar(miembro.foto_perfil)} alt={miembro.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          miembro.nombre.charAt(0).toUpperCase()
                                        )}
                                      </div>
                                      <span className={`miembro-status-dot ${miembro.esta_online ? 'online' : ''}`} />
                                      {isCoord && (
                                        <div className="miembro-crown-icon">
                                          <Crown size={7} color="#fff" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Botón para expandir y ver lista detallada */}
                            {miembros.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedAreaId(isExpanded ? null : area.id)}
                                style={{
                                  background: 'none',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{isExpanded ? 'Ocultar' : `Ver ${miembros.length}`}</span>
                                <ChevronRight size={13} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Fila expandida con detalle de miembros para el Admin */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={3} style={{ padding: '12px 20px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                              {miembros.map(m => (
                                <div key={m.id} style={{
                                  background: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                                      {m.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {m.nombre}
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                                        @{m.usuario || 'sin_usuario'}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setAgenteParaReset(m)}
                                    style={{
                                      padding: '4px 8px',
                                      background: '#fffbeb',
                                      border: '1px solid #fde68a',
                                      borderRadius: '6px',
                                      color: '#b45309',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      flexShrink: 0
                                    }}
                                    title="Generar contraseña temporal"
                                  >
                                    <Key size={12} />
                                    <span>Clave</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── MODAL PARA GENERAR CONTRASEÑA TEMPORAL ──────────────────────────── */}
      {agenteParaReset && (
        <ResetTemporalModal
          agente={agenteParaReset}
          onClose={() => {
            setAgenteParaReset(null);
            loadData(true);
          }}
          onPasswordReset={() => {
            loadData(true);
          }}
        />
      )}
    </div>
  );
};

export default EquiposView;
