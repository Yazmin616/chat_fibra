import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Users, Star, Building2, Tag, TrendingUp, Calendar } from 'lucide-react';
import { apiService } from '../../services/api';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f97316', '#14b8a6', '#8b5cf6', '#3b82f6'];

function initials(nombre) {
  return (nombre || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function avatarColor(id) {
  return AVATAR_COLORS[(parseInt(id) || 0) % AVATAR_COLORS.length];
}

const SatPill = ({ pct }) => {
  const n = parseInt(pct);
  if (isNaN(n)) return <span style={{ color: 'var(--dash-text-muted)' }}>—</span>;
  const color = n >= 70 ? '#22c55e' : n >= 40 ? '#f97316' : '#ef4444';
  return <span style={{ color, fontWeight: 700 }}>{n}%</span>;
};

const DETAIL_TABS = [
  { key: 'empresa', label: 'Por Empresa', Icon: Building2 },
  { key: 'area',    label: 'Por Área',    Icon: Tag },
];

const AgenteDetalleModal = ({ agente, onClose }) => {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('empresa');

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!agente?.id) return;
    setLoading(true);
    apiService.getAgenteStats(agente.id)
      .then(data  => setStats(data))
      .catch(err  => console.error('[AgenteDetalleModal]', err))
      .finally(() => setLoading(false));
  }, [agente?.id]);

  const r = stats?.resumen;
  const satN = parseInt(r?.satisfaccion_pct);
  const satColor = satN >= 70 ? '#22c55e' : satN >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="asesor-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="asesor-modal-header">
          <div className="asesor-modal-identity">
            <div className="asesor-modal-avatar" style={{ background: avatarColor(agente.id) }}>
              {initials(agente.nombre)}
            </div>
            <div>
              <h2 className="asesor-modal-name">{agente.nombre}</h2>
              <span className="asesor-modal-area">{agente.area || 'Sin área'}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="asesor-modal-loading">
            <div className="spinner" /> Cargando estadísticas...
          </div>
        ) : (
          <>
            {/* KPIs del asesor */}
            <div className="asesor-kpis">
              <div className="asesor-kpi">
                <MessageSquare size={16} color="#3b82f6" />
                <div className="asesor-kpi-val">{r?.total_conversaciones ?? 0}</div>
                <div className="asesor-kpi-lbl">Total chats</div>
              </div>
              <div className="asesor-kpi">
                <TrendingUp size={16} color="#8b5cf6" />
                <div className="asesor-kpi-val">{r?.esta_semana ?? 0}</div>
                <div className="asesor-kpi-lbl">Esta semana</div>
              </div>
              <div className="asesor-kpi">
                <Calendar size={16} color="#14b8a6" />
                <div className="asesor-kpi-val">{r?.este_mes ?? 0}</div>
                <div className="asesor-kpi-lbl">Últimos 30 días</div>
              </div>
              <div className="asesor-kpi">
                <Users size={16} color="#06b6d4" />
                <div className="asesor-kpi-val">{r?.clientes_unicos ?? 0}</div>
                <div className="asesor-kpi-lbl">Clientes únicos</div>
              </div>
              <div className="asesor-kpi">
                <Star size={16} color="#f97316" />
                <div className="asesor-kpi-val" style={{ color: !isNaN(satN) ? satColor : undefined }}>
                  {!isNaN(satN) ? `${satN}%` : '—'}
                </div>
                <div className="asesor-kpi-lbl">Desempeño</div>
              </div>
            </div>

            {/* Desglose CSAT */}
            {parseInt(r?.total_calificaciones) > 0 && (
              <div className="asesor-csat-row">
                <span className="asesor-csat-chip" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)' }}>
                  Bien · {r.bien}
                </span>
                <span className="asesor-csat-chip" style={{ color: '#f97316', background: 'rgba(249,115,22,0.08)' }}>
                  Regular · {r.regular}
                </span>
                <span className="asesor-csat-chip" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                  Mal · {r.mal}
                </span>
                <span style={{ fontSize: 11, color: 'var(--dash-text-muted)' }}>
                  {r.total_calificaciones} evaluaciones en total
                </span>
              </div>
            )}

            {/* Tabs de desglose */}
            <div className="asesor-tabs">
              {DETAIL_TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={`asesor-tab${tab === key ? ' active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>

            {/* Tabla por empresa */}
            {tab === 'empresa' && (
              <div className="asesor-breakdown">
                {!stats?.porEmpresa?.length ? (
                  <p className="asesor-empty">Sin datos de empresa</p>
                ) : (
                  <>
                    <div className="asesor-breakdown-header">
                      <span>Empresa</span>
                      <span>Chats</span>
                      <span>Clientes</span>
                      <span>Satis.</span>
                    </div>
                    {stats.porEmpresa.map((row, i) => (
                      <div key={i} className="asesor-breakdown-row">
                        <span className="asesor-empresa-tag">{row.empresa_id}</span>
                        <span>{row.chats}</span>
                        <span>{row.clientes}</span>
                        <SatPill pct={row.satisfaccion_pct} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Tabla por área */}
            {tab === 'area' && (
              <div className="asesor-breakdown">
                {!stats?.porArea?.length ? (
                  <p className="asesor-empty">Sin datos de área</p>
                ) : (
                  <>
                    <div className="asesor-breakdown-header cols-3">
                      <span>Área</span>
                      <span>Chats</span>
                      <span>Satis.</span>
                    </div>
                    {stats.porArea.map((row, i) => (
                      <div key={i} className="asesor-breakdown-row cols-3">
                        <span className="asesor-area-tag">{row.area}</span>
                        <span>{row.chats}</span>
                        <SatPill pct={row.satisfaccion_pct} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AgenteDetalleModal;
