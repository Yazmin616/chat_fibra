import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, Users, UserX, RefreshCw, CheckCircle, X } from 'lucide-react';
import { apiService } from '../../services/api';
import '../../styles/infracciones.css';

const TIPO_CONFIG = {
  area:   { label: 'Sin atender',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  Icon: Users },
  agente: { label: 'Sin seguimiento', color: '#f97316', bg: 'rgba(249,115,22,0.1)', Icon: UserX },
};

const InfraccionesView = ({ user, empresaId, socket }) => {
  const [infracciones, setInfracciones] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroArea,   setFiltroArea]   = useState('');
  const [filtroTipo,   setFiltroTipo]   = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiService.getInfracciones(user?.id, empresaId);
      setInfracciones(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[InfraccionesView]', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, empresaId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (empresaId !== 'todas' && data.empresa_id !== empresaId) return;
      setInfracciones(prev => [data, ...prev]);
    };
    socket.on('nueva_infraccion', handler);
    return () => socket.off('nueva_infraccion', handler);
  }, [socket, empresaId]);

  const areas = [...new Set(infracciones.map(i => i.departamento).filter(Boolean))];

  const filtradas = infracciones
    .filter(i => !filtroArea || i.departamento === filtroArea)
    .filter(i => !filtroTipo || i.tipo === filtroTipo);

  // KPIs
  const today    = new Date().toDateString();
  const hoy      = infracciones.filter(i => new Date(i.created_at).toDateString() === today).length;
  const deArea   = infracciones.filter(i => i.tipo === 'area').length;
  const deAgente = infracciones.filter(i => i.tipo === 'agente').length;
  const maxEspera = infracciones.reduce((m, i) => Math.max(m, i.tiempo_espera), 0);

  return (
    <div className="infracciones-view">

      {/* Header */}
      <div className="inf-header">
        <div className="inf-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={22} color="#ef4444" /> Infracciones
          </h1>
          <p className="inf-sub">
            Incidencias por falta de atención detectadas automáticamente
          </p>
        </div>
        <button className="inf-refresh-btn" onClick={cargar}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="inf-kpis">
        <div className="inf-kpi">
          <div className="inf-kpi-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle size={20} color="#ef4444" />
          </div>
          <div>
            <div className="inf-kpi-value">{hoy}</div>
            <div className="inf-kpi-label">Hoy</div>
          </div>
        </div>

        <div className="inf-kpi">
          <div className="inf-kpi-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Users size={20} color="#ef4444" />
          </div>
          <div>
            <div className="inf-kpi-value">{deArea}</div>
            <div className="inf-kpi-label">Sin atender</div>
          </div>
        </div>

        <div className="inf-kpi">
          <div className="inf-kpi-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <UserX size={20} color="#f97316" />
          </div>
          <div>
            <div className="inf-kpi-value">{deAgente}</div>
            <div className="inf-kpi-label">Sin seguimiento</div>
          </div>
        </div>

        {maxEspera > 0 && (
          <div className="inf-kpi">
            <div className="inf-kpi-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Clock size={20} color="#ef4444" />
            </div>
            <div>
              <div className="inf-kpi-value">{maxEspera} min</div>
              <div className="inf-kpi-label">Mayor espera</div>
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      {infracciones.length > 0 && (
        <div className="inf-filter-bar">
          <AlertTriangle size={14} color="#a0aec0" />
          <span className="inf-filter-label">Filtrar por</span>

          <select className="inf-filter-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">— Todos los tipos —</option>
            <option value="area">Sin atender (área)</option>
            <option value="agente">Sin seguimiento (agente)</option>
          </select>

          {areas.length > 1 && (
            <select className="inf-filter-select" value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
              <option value="">— Todas las áreas —</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          {(filtroTipo || filtroArea) && (
            <button className="inf-filter-clear" onClick={() => { setFiltroTipo(''); setFiltroArea(''); }}>
              <X size={11} /> Limpiar
            </button>
          )}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="inf-loading">
          <div className="spinner" /> Cargando infracciones...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="inf-empty">
          <div className="inf-empty-icon">
            <CheckCircle size={40} color="#22c55e" />
          </div>
          <p>{infracciones.length === 0 ? 'No hay infracciones registradas.' : 'No hay resultados para los filtros aplicados.'}</p>
        </div>
      ) : (
        <div className="inf-card">
          <div className="inf-table-header">
            <span>#</span>
            <span>Tipo</span>
            <span>Cliente</span>
            <span>Responsable</span>
            <span>Área</span>
            <span>Espera</span>
            <span>Fecha</span>
          </div>

          {filtradas.map((inf, i) => {
            const cfg = TIPO_CONFIG[inf.tipo] || TIPO_CONFIG.area;
            return (
              <div key={inf.id} className="inf-table-row">
                <span className="inf-num">{i + 1}</span>

                <span>
                  <span className="inf-tipo-badge" style={{ background: cfg.bg, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <cfg.Icon size={12} /> {cfg.label}
                  </span>
                </span>

                <span className="inf-cliente">{inf.cliente_nombre || 'Desconocido'}</span>

                <span className="inf-responsable">
                  {inf.tipo === 'agente'
                    ? <><span className="inf-agente-dot" />  {inf.agente_nombre || '—'}</>
                    : <span style={{ color: '#a0aec0', fontSize: 12 }}>Equipo {inf.departamento}</span>
                  }
                </span>

                <span><span className="inf-area-badge">{inf.departamento || '—'}</span></span>

                <span className="inf-espera">{inf.tiempo_espera} min</span>

                <span className="inf-fecha">
                  {new Date(inf.created_at).toLocaleString('es-MX', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default InfraccionesView;
