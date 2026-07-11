import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smile, Frown, Meh, Loader2, HelpCircle,
  CheckCircle2, AlertTriangle,
  Users, MessageSquare, Clock, BarChart3,
  TrendingUp, TrendingDown, Maximize2, Minimize2,
  Wifi, WifiOff, Activity
} from 'lucide-react';
import { apiService } from '../../services/api';
import '../../styles/staff-dashboard.css';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Sin actividad';
  const diff = Math.floor((Date.now() - new Date(lastSeen)) / 1000);
  if (diff < 60)    return 'Hace un momento';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} días`;
}

function npsColor(score) {
  if (score > 50)  return '#16a34a';
  if (score > 0)   return '#ca8a04';
  return '#dc2626';
}

function npsBg(score) {
  if (score > 50)  return '#f0fdf4';
  if (score > 0)   return '#fefce8';
  return '#fef2f2';
}

// ─────────────────────────────────────────────
// Semicírculo NPS
// ─────────────────────────────────────────────
const NpsGauge = ({ score }) => {
  const normalizedScore = (score + 100) / 2;
  const color = npsColor(score);
  return (
    <div style={{ position: 'relative', width: '220px', height: '130px', margin: '0 auto' }}>
      <svg viewBox="0 0 100 50" style={{ width: '100%', overflow: 'visible' }}>
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={125.6}
          strokeDashoffset={125.6 - (125.6 * normalizedScore) / 100}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontSize: '36px', fontWeight: '800', color, marginTop: '-18px' }}>{score}</div>
        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>NPS del equipo</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Tarjeta KPI
// ─────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color = '#3b82f6', bg = '#eff6ff' }) => (
  <div className="sd-kpi-card">
    <div className="sd-kpi-icon" style={{ background: bg, color }}>{icon}</div>
    <div className="sd-kpi-body">
      <div className="sd-kpi-value" style={{ color }}>{value}</div>
      <div className="sd-kpi-label">{label}</div>
      {sub && <div className="sd-kpi-sub">{sub}</div>}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
const NpsDashboardView = ({ empresaId, user, socket }) => {
  const [stats, setStats]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [sortBy, setSortBy]   = useState('nps');
  const [sortDir, setSortDir] = useState('desc');
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef(null);

  const esAdmin = user?.rol === 'admin';
  const titulo  = esAdmin ? 'Evaluación de Desempeño — Staff General' : 'Dashboard de mi Staff';

  // ── Carga de datos (silenciosa: no muestra spinner una vez cargado)
  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getNpsStats(empresaId === 'todas' ? '' : empresaId);
      setStats(data || []);
      setLastUpdate(new Date());
      setError('');
    } catch {
      setError('Error al obtener métricas del staff');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  // Carga inicial
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Polling vía Socket.io: cuando algún agente cambia de estado
  // o hay una conversación nueva, refrescamos datos sin mostrar spinner
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchStats();
    socket.on('agentes_actualizados',       refresh);
    socket.on('nueva_conversacion',         refresh);
    socket.on('conversacion_actualizada',   refresh);
    socket.on('conversacion_asignada',      refresh);
    socket.on('conversacion_cerrada',       refresh);
    return () => {
      socket.off('agentes_actualizados',       refresh);
      socket.off('nueva_conversacion',         refresh);
      socket.off('conversacion_actualizada',   refresh);
      socket.off('conversacion_asignada',      refresh);
      socket.off('conversacion_cerrada',       refresh);
    };
  }, [socket, fetchStats]);

  // ── Pantalla completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Ordenamiento de tabla
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sorted = [...stats].sort((a, b) => {
    const va = parseFloat(a[sortBy] ?? 0);
    const vb = parseFloat(b[sortBy] ?? 0);
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // ── KPIs globales
  const totalAgentes     = stats.length;
  const enLinea          = stats.filter(r => r.esta_online).length;
  const totalActivos     = stats.reduce((s, r) => s + parseInt(r.chats_activos   || 0), 0);
  const totalEsperando   = stats.reduce((s, r) => s + parseInt(r.chats_esperando || 0), 0);
  const totalPromotores  = stats.reduce((s, r) => s + parseInt(r.promotores      || 0), 0);
  const totalNeutrales   = stats.reduce((s, r) => s + parseInt(r.neutrales       || 0), 0);
  const totalDetractores = stats.reduce((s, r) => s + parseInt(r.detractores     || 0), 0);
  const totalNoContestan = stats.reduce((s, r) => s + parseInt(r.no_contestan    || 0), 0);
  const totalEncuestas   = totalPromotores + totalNeutrales + totalDetractores;
  const globalNps        = totalEncuestas > 0
    ? Math.round(((totalPromotores / totalEncuestas) - (totalDetractores / totalEncuestas)) * 100)
    : 0;

  // ── Encabezado de columna ordenable
  const SortTh = ({ col, children }) => (
    <th className="sd-th sortable" onClick={() => toggleSort(col)}>
      {children}
      <span className="sd-sort-indicator">
        {sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="sd-loading">
        <Loader2 className="sd-spinner" size={36} />
        <span>Cargando métricas…</span>
      </div>
    );
  }

  return (
    <div className={`sd-root ${fullscreen ? 'sd-fullscreen-mode' : ''}`} ref={rootRef}>

      {/* ══ ENCABEZADO ══ */}
      <div className="sd-header">
        <div className="sd-header-left">
          <h1 className="sd-title">{titulo}</h1>
          <div className="sd-live-indicator">
            <span className="sd-live-dot" />
            <span>
              En tiempo real
              {lastUpdate && ` · Actualizado ${formatLastSeen(lastUpdate)}`}
            </span>
          </div>
        </div>

        <button
          className="sd-fullscreen-btn"
          onClick={toggleFullscreen}
          title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (para TV)'}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {fullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      {error && <div className="sd-error">{error}</div>}

      {/* ══ KPIs SUPERIORES ══ */}
      <div className="sd-kpi-grid">
        <KpiCard
          icon={<Users size={20} />}
          label="Agentes en el equipo"
          value={totalAgentes}
          sub={`${enLinea} conectados ahora`}
          color="#3b82f6"
          bg="#eff6ff"
        />
        <KpiCard
          icon={<Wifi size={20} />}
          label="Conectados"
          value={enLinea}
          sub={totalAgentes > 0 ? `${Math.round(enLinea / totalAgentes * 100)}% del equipo activo` : '—'}
          color="#16a34a"
          bg="#f0fdf4"
        />
        <KpiCard
          icon={<MessageSquare size={20} />}
          label="Chats en atención"
          value={totalActivos}
          sub="Conversaciones abiertas ahora"
          color="#7c3aed"
          bg="#f5f3ff"
        />
        <KpiCard
          icon={<Clock size={20} />}
          label="Sin respuesta"
          value={totalEsperando}
          sub={totalEsperando > 0 ? 'Clientes esperando atención' : 'Todo atendido al día'}
          color={totalEsperando > 0 ? '#ef4444' : '#16a34a'}
          bg={totalEsperando > 0 ? '#fef2f2' : '#f0fdf4'}
        />
      </div>

      {/* ══ NPS GLOBAL ══ */}
      <div className="sd-nps-panel">
        <div className="sd-nps-gauge-wrap">
          <h3 className="sd-panel-title">NPS Global del Equipo</h3>
          <NpsGauge score={globalNps} />
        </div>
        <div className="sd-nps-stats">
          <div className="sd-nps-stat">
            <div className="sd-nps-stat-icon" style={{ background: '#dcfce7' }}>
              <Smile size={22} color="#16a34a" />
            </div>
            <div>
              <div className="sd-nps-stat-value" style={{ color: '#16a34a' }}>{totalPromotores}</div>
              <div className="sd-nps-stat-label">Promotores</div>
              <div className="sd-nps-stat-hint">Calificaron Excelente (5 estrellas)</div>
            </div>
          </div>
          <div className="sd-nps-stat">
            <div className="sd-nps-stat-icon" style={{ background: '#fef9c3' }}>
              <Meh size={22} color="#ca8a04" />
            </div>
            <div>
              <div className="sd-nps-stat-value" style={{ color: '#ca8a04' }}>{totalNeutrales}</div>
              <div className="sd-nps-stat-label">Neutrales</div>
              <div className="sd-nps-stat-hint">Calificaron Bien (4 estrellas)</div>
            </div>
          </div>
          <div className="sd-nps-stat">
            <div className="sd-nps-stat-icon" style={{ background: '#fee2e2' }}>
              <Frown size={22} color="#dc2626" />
            </div>
            <div>
              <div className="sd-nps-stat-value" style={{ color: '#dc2626' }}>{totalDetractores}</div>
              <div className="sd-nps-stat-label">Detractores</div>
              <div className="sd-nps-stat-hint">Calificaron Regular o Malo (1–3)</div>
            </div>
          </div>
          <div className="sd-nps-stat">
            <div className="sd-nps-stat-icon" style={{ background: '#f3f4f6' }}>
              <HelpCircle size={22} color="#6b7280" />
            </div>
            <div>
              <div className="sd-nps-stat-value" style={{ color: '#6b7280' }}>{totalNoContestan}</div>
              <div className="sd-nps-stat-label">No Contestan</div>
              <div className="sd-nps-stat-hint">Encuesta enviada pero ignorada</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ TABLA DE STAFF ══ */}
      <div className="sd-table-wrap">
        <div className="sd-table-header">
          <h3 className="sd-panel-title" style={{ margin: 0 }}>
            <BarChart3 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Rendimiento Individual
          </h3>
        </div>

        <div className="sd-table-scroll">
          <table className="sd-table">
            <thead>
              <tr>
                <th className="sd-th">Agente</th>
                <th className="sd-th">Conexión</th>
                <SortTh col="chats_activos">Chats Activos</SortTh>
                <SortTh col="chats_esperando">Sin Respuesta</SortTh>
                <SortTh col="conversaciones">Conversaciones</SortTh>
                <SortTh col="conversaciones_calificadas">Calificadas</SortTh>
                <SortTh col="nps">NPS</SortTh>
                <SortTh col="promotores">Promotores</SortTh>
                <SortTh col="neutrales">Neutrales</SortTh>
                <SortTh col="detractores">Detractores</SortTh>
                <th className="sd-th">No Contestan</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const sinRespuesta = parseInt(row.chats_esperando || 0);
                const nps = parseFloat(row.nps || 0);
                return (
                  <tr key={row.id || idx} className="sd-tr">
                    <td className="sd-td sd-agent-cell">
                      <div className="sd-agent-avatar">
                        {row.staff?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="sd-agent-name">{row.staff}</span>
                    </td>

                    <td className="sd-td">
                      <div className="sd-status-pill" data-online={row.esta_online ? 'true' : 'false'}>
                        <span className={`sd-dot ${row.esta_online ? 'online' : 'offline'}`} />
                        <span>{row.esta_online ? 'En línea' : formatLastSeen(row.last_seen)}</span>
                      </div>
                    </td>

                    <td className="sd-td sd-center">
                      <span className="sd-badge-blue">{row.chats_activos || 0}</span>
                    </td>

                    <td className="sd-td sd-center">
                      {sinRespuesta > 0 ? (
                        <div className="sd-pending-pill">
                          <AlertTriangle size={11} />
                          <span>{sinRespuesta}</span>
                        </div>
                      ) : (
                        <div className="sd-ok-pill">
                          <CheckCircle2 size={11} />
                          <span>Al día</span>
                        </div>
                      )}
                    </td>

                    <td className="sd-td sd-center">{row.conversaciones}</td>
                    <td className="sd-td sd-center">{row.conversaciones_calificadas}</td>

                    <td className="sd-td sd-center">
                      <span className="sd-nps-badge" style={{ color: npsColor(nps), background: npsBg(nps) }}>
                        {nps > 0 && <TrendingUp size={11} />}
                        {nps < 0 && <TrendingDown size={11} />}
                        {nps}%
                      </span>
                    </td>

                    <td className="sd-td sd-center sd-green">{row.promotores}</td>
                    <td className="sd-td sd-center sd-yellow">{row.neutrales}</td>
                    <td className="sd-td sd-center sd-red">{row.detractores}</td>
                    <td className="sd-td sd-center sd-gray">{row.no_contestan}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan="11" className="sd-empty">
                    <Activity size={28} style={{ opacity: 0.3 }} />
                    <span>No hay datos de staff disponibles.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NpsDashboardView;
