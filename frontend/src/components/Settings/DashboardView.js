import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, MessageSquare, CheckCircle, Clock, Star, Users, Award, BarChart2, RefreshCw } from 'lucide-react';

const API_URL = `http://${window.location.hostname}:3009`;

// --- Mini componentes ---

const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className="kpi-card">
    <div className="kpi-icon" style={{ background: `${color}15` }}>
      <Icon size={24} color={color} />
    </div>
    <div className="kpi-body">
      <div className="kpi-value">{value ?? '0'}</div>
      <div className="kpi-label">{label}</div>
    </div>
  </div>
);

const DonutChart = ({ bien, regular, mal, total }) => {
  const b = parseInt(bien) || 0;
  const r = parseInt(regular) || 0;
  const m = parseInt(mal) || 0;
  const tot = b + r + m || 1;

  const pct = { bien: (b / tot) * 100, regular: (r / tot) * 100, mal: (m / tot) * 100 };

  // SVG donut via stroke-dasharray
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offsets = [
    { pct: pct.bien, color: '#22c55e', label: 'Bien' },
    { pct: pct.regular, color: '#f97316', label: 'Regular' },
    { pct: pct.mal, color: '#ef4444', label: 'Mal' },
  ];

  let cumulative = 0;
  return (
    <div className="donut-container">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {offsets.map((seg, i) => {
          const dash = (seg.pct / 100) * circ;
          const gap = circ - dash;
          const rotate = -90 + (cumulative / 100) * 360;
          cumulative += seg.pct;
          return (
            <circle
              key={i}
              cx="70" cy="70" r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset="0"
              style={{ transform: `rotate(${rotate}deg)`, transformOrigin: '70px 70px', transition: 'stroke-dasharray 0.6s ease' }}
            />
          );
        })}
        <text x="70" y="65" textAnchor="middle" fill="#e2e8f0" fontSize="22" fontWeight="bold">{tot}</text>
        <text x="70" y="83" textAnchor="middle" fill="#94a3b8" fontSize="10">evaluaciones</text>
      </svg>
      <div className="donut-legend">
        {[
          { label: 'Bien', val: b, color: '#22c55e' },
          { label: 'Regular', val: r, color: '#f97316' },
          { label: 'Mal', val: m, color: '#ef4444' },
        ].map(item => (
          <div key={item.label} className="legend-row">
            <span className="legend-dot" style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
            <span className="legend-val">{item.val}</span>
            <span className="legend-pct" style={{ color: item.color }}>
              {tot > 0 ? Math.round((item.val / tot) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ data }) => {
  if (!data || data.length === 0) return (
    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Sin actividad en los últimos 7 días</div>
  );
  const maxVal = Math.max(...data.map(d => parseInt(d.chats)), 1);
  return (
    <div className="bar-chart-container">
      {data.map((d, i) => {
        const h = Math.max(8, (parseInt(d.chats) / maxVal) * 100);
        return (
          <div key={i} className="bar-col">
            <div className="bar-fill" style={{ height: `${h}%` }}>
              <div className="bar-tooltip">{d.chats}</div>
            </div>
            <div className="bar-label">{d.dia}</div>
          </div>
        );
      })}
    </div>
  );
};

const RatingBadge = ({ puntuacion }) => {
  const cfg = {
    Bien: { bg: '#22c55e22', color: '#22c55e', icon: '😊' },
    Regular: { bg: '#f9731622', color: '#f97316', icon: '😐' },
    Mal: { bg: '#ef444422', color: '#ef4444', icon: '😞' },
  }[puntuacion] || { bg: '#64748b22', color: '#64748b', icon: '?' };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.icon} {puntuacion}
    </span>
  );
};

// --- Vista principal ---
const DashboardView = ({ user, empresaId, socket }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState('light'); // 'light' is default

  const fetchDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent && !data) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agente/dashboard?agente_id=${user?.id}&empresa_id=${empresaId}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, empresaId, data]);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Carga inicial y polling de seguridad (cada 5 min)
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id, empresaId]);

  // Suscribirse a eventos en tiempo real
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchDashboard(true);
    socket.on('nuevo_mensaje', handleUpdate);
    socket.on('conversacion_actualizada', handleUpdate);
    socket.on('nueva_calificacion', handleUpdate);
    return () => {
      socket.off('nuevo_mensaje', handleUpdate);
      socket.off('conversacion_actualizada', handleUpdate);
      socket.off('nueva_calificacion', handleUpdate);
    };
  }, [socket, fetchDashboard]);

  const esAdmin = user?.rol === 'admin';

  if (loading && !data) return (
    <div className={`dashboard-view ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Cargando datos estratégicos...</p>
      </div>
    </div>
  );

  const { kpis, calificaciones, actividadDiaria, topAgentes, ultimasCalificaciones } = data || {};
  const satisfaccionPct = calificaciones?.total > 0
    ? Math.round((parseInt(calificaciones.bien) / parseInt(calificaciones.total)) * 100)
    : 0;

  return (
    <div className={`dashboard-view ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {/* Header */}
      <div className="dash-header">
        <div className="dash-title-group">
          <h1>{esAdmin ? '📊 Panel General' : `📊 Mi Rendimiento`}</h1>
          <p className="dash-sub">
            {esAdmin ? 'Visión global de la operación' : `Asesor · ${user?.area}`} 
          </p>
        </div>
        
        <div className="dash-actions">
          <div className="theme-toggle-group">
            <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>☀️</button>
            <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>🌙</button>
          </div>
          <div className="dash-clock">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard icon={MessageSquare} label="Chats Hoy" value={kpis?.hoy} color="#3b82f6" />
        <KpiCard icon={TrendingUp} label="Semana" value={kpis?.semana} color="#8b5cf6" />
        <KpiCard icon={CheckCircle} label="Cerrados" value={kpis?.total_cerrados} color="#22c55e" />
        <KpiCard icon={Star} label="Satisfacción" value={`${satisfaccionPct}%`} color={satisfaccionPct >= 70 ? '#22c55e' : '#f97316'} />
        <KpiCard icon={Clock} label="Activos" value={kpis?.activos} color="#f97316" />
      </div>

      {/* Rows Grid */}
      <div className="dash-row-2">
        <div className="dash-card">
          <div className="dash-card-header">
            <BarChart2 size={18} color="var(--dash-accent)" />
            <h2>Calificaciones</h2>
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

      <div className="dash-row-3">
        {esAdmin && (
          <div className="dash-card">
            <div className="dash-card-header">
              <Users size={18} color="var(--dash-accent)" />
              <h2>Ranking de Asesores</h2>
            </div>
            <div className="agent-table">
              <div className="agent-table-header">
                <span>#</span><span>Asesor</span><span>Área</span><span>Total</span><span>Sem</span><span>Satis.</span>
              </div>
              {topAgentes?.map((a, i) => (
                <div key={i} className="agent-table-row">
                  <span className="rank-num">{i + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="agent-name">{a.nombre}</span>
                    <span className="agent-area">{a.area}</span>
                  </div>
                  <span style={{ textAlign: 'center' }}>{a.total_chats}</span>
                  <span style={{ textAlign: 'center' }}>{a.esta_semana}</span>
                  <span style={{ textAlign: 'center', fontWeight: 700, color: parseInt(a.satisfaccion_pct) >= 70 ? '#22c55e' : '#f97316' }}>
                    {a.satisfaccion_pct ? `${a.satisfaccion_pct}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dash-card">
          <div className="dash-card-header">
            <Award size={18} color="var(--dash-accent)" />
            <h2>Últimas Evaluaciones</h2>
          </div>
          <div className="ratings-list">
            {ultimasCalificaciones?.map((cal, i) => (
              <div key={i} className="rating-row">
                <RatingBadge puntuacion={cal.puntuacion} />
                <div className="rating-info">
                  <span className="rating-client">{cal.cliente}</span>
                  <div className="rating-details">
                    <span>{cal.agente || 'Bot'}</span> · <span>{cal.departamento}</span>
                  </div>
                  <span className="rating-time">{new Date(cal.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
