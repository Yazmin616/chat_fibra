import React, { useState, useEffect, useRef } from 'react';
import { Shield, Users, Search, Check, AlertCircle, Loader2, ChevronDown, UserCheck, X, Crown } from 'lucide-react';
import { apiService, resolveAvatar } from '../../services/api';
import '../../styles/equipos.css';

const EquiposView = ({ empresaId, user }) => {
  const [areas, setAreas] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null); // id del área con dropdown abierto
  const [searchTerm, setSearchTerm] = useState('');
  const [saveStatus, setSaveStatus] = useState({}); // { [areaId]: 'saving' | 'saved' | 'error' }
  const dropdownRef = useRef(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [areasData, agentesData] = await Promise.all([
        apiService.getAreasSoluciones(empresaId),
        apiService.getAgentes()
      ]);
      setAreas(areasData);
      setAgentes(agentesData);
    } catch (err) {
      console.error("Error al cargar datos de equipos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [empresaId]);

  // Cerrar dropdown al hacer clic afuera
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
    setActiveDropdown(null);
    setSearchTerm('');
    const areaId = area.id;

    // Estado local visual de guardando
    setSaveStatus(prev => ({ ...prev, [areaId]: 'saving' }));

    try {
      // Mandar actualización al backend
      await apiService.updateAreaSolucion(areaId, {
        ...area,
        coordinador_id: coordinatorId
      });

      setSaveStatus(prev => ({ ...prev, [areaId]: 'saved' }));

      // Recargar datos locales de inmediato para reflejar el cambio
      const updatedAreas = await apiService.getAreasSoluciones(empresaId);
      setAreas(updatedAreas);

      // Ocultar mensaje de guardado tras 3 segundos
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

  if (loading) {
    return (
      <div className="equipos-loading">
        <Loader2 className="animate-spin" size={32} />
        <span>Cargando lista de equipos...</span>
      </div>
    );
  }

  return (
    <div className="equipos-container">
      <div className="equipos-header">
        <h1>
          <Users size={24} style={{ color: 'var(--primary)' }} />
          Gestión de Equipos
        </h1>
        <p>
          Administra los líderes de área y visualiza la lista de miembros asignados a cada equipo.
        </p>
      </div>

      {areas.length === 0 ? (
        <div className="equipos-empty-state">
          <Shield size={44} style={{ color: '#94a3b8' }} />
          <h3>No hay equipos disponibles</h3>
          <p>
            No se encontraron áreas de soluciones configuradas para esta empresa. Crea un área primero en el panel de Configuración {"->"} Áreas y Soluciones.
          </p>
        </div>
      ) : (
        <>
          {/* TABLA DE ESCRITORIO / TABLET */}
          <div className="equipos-table-wrapper">
            <table className="equipos-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Equipo</th>
                  <th style={{ width: '30%' }}>Líder de Área (Coordinador)</th>
                  <th style={{ width: '35%' }}>Miembros del Equipo</th>
                </tr>
              </thead>
              <tbody>
                {areas.map(area => {
                  // Filtrar miembros del equipo (agentes de esta área)
                  const miembros = agentes.filter(ag => 
                    (ag.area || '').trim().toLowerCase() === (area.nombre_area || '').trim().toLowerCase()
                  );

                  // Obtener datos del coordinador actual
                  const coordinador = agentes.find(ag => ag.id === area.coordinador_id);
                  const status = saveStatus[area.id];

                  return (
                    <tr key={area.id}>
                      
                      {/* Columna 1: Info del Equipo */}
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

                      {/* Columna 2: Coordinador con Selector Dropdown */}
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

                          {/* Indicador de estado de guardado alineado */}
                          <div className={`save-status-row-indicator ${status ? 'visible' : ''} ${status === 'error' ? 'error' : ''} ${status === 'saving' ? 'saving' : ''}`}>
                            {status === 'saving' && <Loader2 className="animate-spin" size={10} />}
                            {status === 'saved' && <Check size={10} />}
                            {status === 'error' && <AlertCircle size={10} />}
                          </div>

                          {/* Dropdown de opciones */}
                          {activeDropdown === area.id && (
                            <div className="coord-dropdown-list" ref={dropdownRef}>
                              <input 
                                type="text" 
                                placeholder="Buscar agente..." 
                                className="coord-search-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus={window.innerWidth > 768}
                              />
                              
                              <div className="coord-options-scroll">
                                {/* Opción para remover */}
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

                                {/* Agentes filtrados (solo del área correspondiente) */}
                                {miembros
                                  .filter(ag => 
                                    ag.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    ag.email.toLowerCase().includes(searchTerm.toLowerCase())
                                  )
                                  .map(ag => {
                                    const isSelected = area.coordinador_id === ag.id;
                                    const agInitials = ag.nombre.charAt(0).toUpperCase();

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
                                              agInitials
                                            )}
                                          </div>
                                          <div>
                                            <div className="coord-option-name">{ag.nombre}</div>
                                            <div className="coord-option-email">{ag.email}</div>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {ag.area && (
                                            <span className="coord-option-area-tag">{ag.area}</span>
                                          )}
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

                      {/* Columna 3: Miembros del Equipo */}
                      <td>
                        <div className="miembros-stack">
                          {miembros.length === 0 ? (
                            <span className="miembros-empty">No hay asesores asignados</span>
                          ) : (
                            miembros.map(miembro => {
                              const isCoordinador = area.coordinador_id === miembro.id;
                              const initials = miembro.nombre.charAt(0).toUpperCase();
                              const onlineText = miembro.esta_online ? 'En línea' : 'Desconectado';
                              const roleText = isCoordinador ? 'Coordinador de Área' : (miembro.rol === 'admin' ? 'Administrador' : 'Asesor');
                              const tooltip = `${miembro.nombre} (${roleText}) - ${onlineText}`;

                              return (
                                <div 
                                  key={miembro.id} 
                                  className={`miembro-avatar-stack ${isCoordinador ? 'es-coordinador' : ''}`} 
                                  data-tooltip={tooltip}
                                >
                                  <div className="miembro-avatar">
                                    {miembro.foto_perfil ? (
                                      <img src={resolveAvatar(miembro.foto_perfil)} alt={miembro.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      initials
                                    )}
                                  </div>
                                  <span className={`miembro-status-dot ${miembro.esta_online ? 'online' : ''}`} />
                                  {isCoordinador && (
                                    <div className="miembro-crown-icon">
                                      <Crown size={7} color="#fff" />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* LISTADO DE TARJETAS PARA MÓVILES */}
          <div className="equipos-mobile-list">
            {areas.map(area => {
              const miembros = agentes.filter(ag => 
                (ag.area || '').trim().toLowerCase() === (area.nombre_area || '').trim().toLowerCase()
              );
              const coordinador = agentes.find(ag => ag.id === area.coordinador_id);
              const status = saveStatus[area.id];

              return (
                <div key={area.id} className="equipos-mobile-card">
                  <div className="equipos-mobile-card-header">
                    <div className={`team-info-cell ${getAreaClass(area.nombre_area)}`}>
                      <div className="team-icon-box">
                        <Shield size={18} />
                      </div>
                      <div className="team-name-wrap">
                        <span className="team-name">{area.nombre_area}</span>
                        <span className="team-desc">{area.descripcion || 'Sin descripción.'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="equipos-mobile-card-body">
                    {/* Líder de Área (Coordinador) */}
                    <div className="equipos-mobile-card-row">
                      <span className="equipos-mobile-card-label">Líder (Coordinador):</span>
                      <div className="coordinador-selector-box" style={{ width: '100%' }}>
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

                        {/* Indicador de estado de guardado */}
                        <div className={`save-status-row-indicator ${status ? 'visible' : ''} ${status === 'error' ? 'error' : ''} ${status === 'saving' ? 'saving' : ''}`}>
                          {status === 'saving' && <Loader2 className="animate-spin" size={10} />}
                          {status === 'saved' && <Check size={10} />}
                          {status === 'error' && <AlertCircle size={10} />}
                        </div>

                        {/* Dropdown de opciones */}
                        {activeDropdown === area.id && (
                          <div className="coord-dropdown-list" ref={dropdownRef} style={{ top: 'auto', bottom: 'calc(100% + 4px)', transform: 'none' }}>
                            <input 
                              type="text" 
                              placeholder="Buscar agente..." 
                              className="coord-search-input"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              autoFocus={window.innerWidth > 768}
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

                              {miembros
                                .filter(ag => 
                                  ag.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  ag.email.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map(ag => {
                                  const isSelected = area.coordinador_id === ag.id;
                                  const agInitials = ag.nombre.charAt(0).toUpperCase();

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
                                            agInitials
                                          )}
                                        </div>
                                        <div>
                                          <div className="coord-option-name">{ag.nombre}</div>
                                          <div className="coord-option-email">{ag.email}</div>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {ag.area && (
                                          <span className="coord-option-area-tag">{ag.area}</span>
                                        )}
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
                    </div>

                    {/* Miembros del Equipo */}
                    <div className="equipos-mobile-card-row" style={{ marginTop: '12px' }}>
                      <span className="equipos-mobile-card-label">Miembros ({miembros.length}):</span>
                      <div className="miembros-stack" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        {miembros.length === 0 ? (
                          <span className="miembros-empty">No hay asesores asignados</span>
                        ) : (
                          miembros.map(miembro => {
                            const isCoordinador = area.coordinador_id === miembro.id;
                            const initials = miembro.nombre.charAt(0).toUpperCase();
                            const onlineText = miembro.esta_online ? 'En línea' : 'Desconectado';
                            const roleText = isCoordinador ? 'Coordinador de Área' : (miembro.rol === 'admin' ? 'Administrador' : 'Asesor');
                            const tooltip = `${miembro.nombre} (${roleText}) - ${onlineText}`;

                            return (
                              <div 
                                key={miembro.id} 
                                className={`miembro-avatar-stack ${isCoordinador ? 'es-coordinador' : ''}`} 
                                data-tooltip={tooltip}
                                style={{ margin: 0 }}
                              >
                                <div className="miembro-avatar">
                                  {miembro.foto_perfil ? (
                                    <img src={resolveAvatar(miembro.foto_perfil)} alt={miembro.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    initials
                                  )}
                                </div>
                                <span className={`miembro-status-dot ${miembro.esta_online ? 'online' : ''}`} />
                                {isCoordinador && (
                                  <div className="miembro-crown-icon">
                                    <Crown size={7} color="#fff" />
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default EquiposView;
