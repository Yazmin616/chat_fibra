import React, { useState } from 'react';
import { TrendingUp, Tag } from 'lucide-react';
import AgenteDetalleModal from './AgenteDetalleModal';

const TABS = [
  { key: 'general', label: 'General',  Icon: TrendingUp },
  { key: 'area',    label: 'Por Área', Icon: Tag },
];

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f97316', '#14b8a6', '#8b5cf6', '#3b82f6'];

function initials(nombre) {
  return (nombre || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

const RankBadge = ({ pos }) => {
  const style =
    pos === 1 ? { background: '#f59e0b', color: '#fff' } :
    pos === 2 ? { background: '#94a3b8', color: '#fff' } :
    pos === 3 ? { background: '#cd7c4b', color: '#fff' } :
               { background: 'transparent', color: 'var(--dash-text-muted)', fontWeight: 600 };
  return <span className="rank-badge" style={style}>{pos}</span>;
};

const SatBar = ({ pct }) => {
  const n = parseInt(pct) || 0;
  if (!pct && pct !== 0) return <span className="sat-empty">—</span>;
  const color = n >= 50 ? '#22c55e' : n > 0 ? '#f97316' : '#ef4444';
  return (
    <div className="sat-bar-wrap">
      <div className="sat-bar-track">
        <div className="sat-bar-fill" style={{ width: `${Math.min(n, 100)}%`, background: color }} />
      </div>
      <span className="sat-bar-pct" style={{ color }}>{n}%</span>
    </div>
  );
};

const AgentRow = ({ agente, pos, colorIdx, onClick }) => (
  <div className="agent-table-row agent-row-clickable" onClick={() => onClick(agente)}>
    <RankBadge pos={pos} />
    <div className="agent-info">
      <div className="agent-avatar" style={{ background: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length] }}>
        {initials(agente.nombre)}
      </div>
      <div className="agent-name-wrap">
        <span className="agent-name">{agente.nombre}</span>
        <div className="agent-name-meta">
          {agente.area && <span className="agent-area-pill">{agente.area}</span>}
          <span className="agent-name-sub">{agente.total_calificaciones ?? 0} eval.</span>
        </div>
      </div>
    </div>
    <div className="agent-vol-wrap">
      <span className="agent-vol-main">{agente.total_chats}</span>
      <span className="agent-vol-sub">{agente.esta_semana} sem.</span>
    </div>
    <SatBar pct={agente.nps_score} />
  </div>
);

const TopAgentesTable = ({ agentes }) => {
  const [tab,      setTab]      = useState('general');
  const [selected, setSelected] = useState(null);

  if (!agentes?.length) {
    return (
      <p style={{ color: 'var(--dash-text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
        Sin datos de asesores
      </p>
    );
  }

  // Backend ya ordena por satisfaccion DESC, total_chats DESC — respetamos ese orden
  const sorted = agentes;

  // Índice global para color de avatar consistente
  const globalIdx = (agente) => agentes.indexOf(agente);

  // Agrupar por área conservando el orden
  const byArea = sorted.reduce((acc, a) => {
    const key = a.area || 'Sin área';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="agent-table-wrap">

      {/* Tabs */}
      <div className="agent-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`agent-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="agent-table-header">
        <span>#</span>
        <span>Asesor</span>
        <span>Chats</span>
        <span>NPS</span>
      </div>

      {/* Ranking general */}
      {tab === 'general' && sorted.map((a, i) => (
        <AgentRow
          key={a.id}
          agente={a}
          pos={i + 1}
          colorIdx={i}
          onClick={setSelected}
        />
      ))}

      {/* Ranking por área */}
      {tab === 'area' && Object.entries(byArea).map(([area, list]) => (
        <React.Fragment key={area}>
          <div className="agent-area-group-header">
            <Tag size={11} />
            <span>{area}</span>
            <span className="agent-area-group-count">
              {list.length} asesor{list.length !== 1 ? 'es' : ''}
            </span>
          </div>
          {list.map((a, i) => (
            <AgentRow
              key={a.id}
              agente={a}
              pos={i + 1}
              colorIdx={globalIdx(a)}
              onClick={setSelected}
            />
          ))}
        </React.Fragment>
      ))}

      {/* Modal de detalle */}
      {selected && (
        <AgenteDetalleModal
          agente={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default TopAgentesTable;
