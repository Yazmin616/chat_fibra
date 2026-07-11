import React, { useState, useEffect } from 'react';
import {
  TrendingUp, MessageSquare, CheckCircle,
  Clock, Star, Users, Award, BarChart2, Filter,
  LayoutDashboard, User, Tag, X,
} from 'lucide-react';

import { useDashboard }          from '../../hooks/useDashboard';
import { apiService }            from '../../services/api';
import KpiCard                   from '../Dashboard/KpiCard';
import DonutChart                from '../Dashboard/DonutChart';
import BarChart                  from '../Dashboard/BarChart';
import TopAgentesTable           from '../Dashboard/TopAgentesTable';
import UltimasCalificaciones     from '../Dashboard/UltimasCalificaciones';
import CalificacionesModal       from '../Dashboard/CalificacionesModal';

const DashboardView = ({ user, empresaId, socket }) => {
  const [filtroAgente,   setFiltroAgente]   = useState('');
  const [filtroArea,     setFiltroArea]     = useState('');
  const [agentes,        setAgentes]        = useState([]);
  const [showAllRatings, setShowAllRatings] = useState(false);

  const esAdmin = user?.rol === 'admin';

  const { data, loading, currentTime } = useDashboard({
    user, empresaId, socket, filtroAgente, filtroArea,
  });

  // Cargar lista de agentes para el filtro (solo admin)
  useEffect(() => {
    if (!esAdmin) return;
    apiService.getAgentes()
      .then(list => setAgentes(list || []))
      .catch(() => {});
  }, [esAdmin]);

  const handleFiltroAgente = (val) => {
    setFiltroAgente(val);
    setFiltroArea('');
  };

  const handleFiltroArea = (val) => {
    setFiltroArea(val);
    setFiltroAgente('');
  };

  const limpiarFiltros = () => {
    setFiltroAgente('');
    setFiltroArea('');
  };

  const hayFiltro = filtroAgente || filtroArea;

  // Áreas únicas derivadas de la lista de asesores
  const areas = [...new Set(agentes.filter(a => a.rol === 'asesor').map(a => a.area).filter(Boolean))];

  if (loading && !data) {
    return (
      <div className="dashboard-view">
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Cargando datos estratégicos...</p>
        </div>
      </div>
    );
  }

  const { kpis, calificaciones, actividadDiaria, topAgentes, ultimasCalificaciones } = data || {};

  const p = parseInt(calificaciones?.promotores) || 0;
  const n = parseInt(calificaciones?.neutrales)  || 0;
  const d = parseInt(calificaciones?.detractores)|| 0;
  const _respondidas = p + n + d;
  const npsScore = _respondidas > 0
    ? Math.round(((p / _respondidas) - (d / _respondidas)) * 100)
    : 0;

  // Etiqueta del filtro activo
  const filtroTag = filtroAgente
    ? agentes.find(a => String(a.id) === String(filtroAgente))?.nombre
    : filtroArea || null;

  return (
    <div className="dashboard-view">

      {/* Header */}
      <div className="dash-header">
        <div className="dash-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutDashboard size={22} color="var(--dash-accent)" />
            {esAdmin ? 'Panel General' : 'Mi Rendimiento'}
          </h1>
          <p className="dash-sub">
            {esAdmin ? 'Visión global de la operación' : `Asesor · ${user?.area}`}
          </p>
        </div>
        <div className="dash-actions">
          <div className="live-badge">
            <div className="pulse-dot" />
            En vivo
          </div>
          <div className="dash-clock">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Barra de filtros (solo admin) */}
      {esAdmin && (
        <div className="dash-filter-bar">
          <Filter size={14} color="var(--dash-text-muted)" />
          <span className="dash-filter-label">Filtrar por</span>

          <select
            className="dash-filter-select"
            value={filtroAgente}
            onChange={e => handleFiltroAgente(e.target.value)}
          >
            <option value="">— Todos los asesores —</option>
            {agentes.filter(a => a.rol === 'asesor').map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>

          <select
            className="dash-filter-select"
            value={filtroArea}
            onChange={e => handleFiltroArea(e.target.value)}
          >
            <option value="">— Todas las áreas —</option>
            {areas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

          {hayFiltro && (
            <>
              <span className="dash-filter-tag">
                {filtroAgente ? <User size={11} /> : <Tag size={11} />} {filtroTag}
              </span>
              <button className="dash-filter-clear" onClick={limpiarFiltros}>
                <X size={11} /> Limpiar
              </button>
            </>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard icon={MessageSquare} label="Chats Hoy"    subtitle="con agente · hoy"              value={kpis?.hoy}             color="#3b82f6" />
        <KpiCard icon={TrendingUp}    label="Esta Semana"  subtitle="con agente · últimos 7 días"    value={kpis?.semana}          color="#8b5cf6" />
        <KpiCard icon={CheckCircle}   label="Cerrados"     subtitle="últimos 7 días"                 value={kpis?.cerrados_semana} color="#22c55e" />
        <KpiCard icon={Star}          label="NPS Global" subtitle="solo agentes · últimos 7 días"  value={`${npsScore}%`} color={npsScore >= 50 ? '#22c55e' : npsScore > 0 ? '#ca8a04' : '#ef4444'} />
        <KpiCard icon={Clock}         label="En Atención"  subtitle="en este momento"                value={kpis?.activos}         color="#f97316" />
      </div>

      {/* Fila 2: Calificaciones + Actividad semanal */}
      <div className="dash-row-2">
        <div className="dash-card">
          <div className="dash-card-header">
            <BarChart2 size={18} color="var(--dash-accent)" />
            <div>
              <h2>Calificaciones</h2>
              <span style={{ fontSize: '11px', color: 'var(--dash-text-muted)' }}>Solo atención de agentes</span>
            </div>
          </div>
          <DonutChart {...calificaciones} />
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <TrendingUp size={18} color="var(--dash-accent)" />
            <h2>Actividad Semanal</h2>
          </div>
          <BarChart data={actividadDiaria} />
        </div>
      </div>

      {/* Fila 3: Ranking de asesores (solo admin) + Últimas evaluaciones */}
      <div className="dash-row-3">
        {esAdmin && !hayFiltro && (
          <div className="dash-card">
            <div className="dash-card-header">
              <Users size={18} color="var(--dash-accent)" />
              <h2>Ranking de Asesores</h2>
            </div>
            <TopAgentesTable agentes={topAgentes} />
          </div>
        )}

        <div className="dash-card">
          <div className="dash-card-header">
            <Award size={18} color="var(--dash-accent)" />
            <h2>Últimas Evaluaciones</h2>
          </div>
          <UltimasCalificaciones calificaciones={ultimasCalificaciones} />
          {(ultimasCalificaciones?.length ?? 0) > 0 && (
            <div className="ratings-footer">
              <button className="ratings-ver-todas" onClick={() => setShowAllRatings(true)}>
                Ver todas las evaluaciones →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: todas las evaluaciones */}
      {showAllRatings && (
        <CalificacionesModal
          user={user}
          empresaId={empresaId}
          filtroAgente={filtroAgente}
          filtroArea={filtroArea}
          onClose={() => setShowAllRatings(false)}
        />
      )}

    </div>
  );
};

export default DashboardView;
