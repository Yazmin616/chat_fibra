import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, ChevronLeft, ChevronRight,
  Calendar, User, Users, Tag, MessageSquare,
  CheckCircle, Loader2, SlidersHorizontal, X, Building2
} from 'lucide-react';
import { apiService, resolveAvatar } from '../../services/api';
import '../../styles/soluciones.css';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fechaCorta(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function hoy() { return new Date().toISOString().slice(0, 10); }
function hace30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

const TIPO_LABELS = {
  manual:    { label: 'Manual',    color: '#7c3aed', bg: '#f5f3ff' },
  bot:       { label: 'Bot',       color: '#0891b2', bg: '#ecfeff' },
  auto:      { label: 'Auto',      color: '#6b7280', bg: '#f3f4f6' },
};

// ─────────────────────────────────────────────
// Badge de categoría
// ─────────────────────────────────────────────
const CategoriaBadge = ({ nombre, color }) => {
  const bg   = color ? `${color}22` : '#e2e8f0';
  const text = color || '#475569';
  return (
    <span className="sol-cat-badge" style={{ background: bg, color: text, borderColor: `${text}44` }}>
      <Tag size={10} />
      {nombre || 'Sin categoría'}
    </span>
  );
};

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
const SolucionesStaffView = ({ empresaId, user, socket }) => {
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Filtros
  const [q, setQ]               = useState('');
  const [area, setArea]         = useState('');
  const [agente, setAgente]     = useState('');
  const [desde, setDesde]       = useState(hace30());
  const [hasta, setHasta]       = useState(hoy());
  const [page, setPage]         = useState(1);
  const LIMIT = 50;

  const [agentes, setAgentes]   = useState([]);
  const [areas, setAreas]       = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const esAdmin        = user?.rol === 'admin';
  const esCoordinador  = user?.es_coordinador || false;
  const esAsesorSimple = !esAdmin && !esCoordinador;

  // Título contextual según rol
  const titulo = esAdmin
    ? 'Soluciones Globales'
    : esCoordinador
    ? 'Soluciones de mi Staff'
    : 'Mis Soluciones';

  // ── Cargar opciones de filtro (agentes y áreas disponibles)
  useEffect(() => {
    apiService.getAgentes?.()
      .then(data => setAgentes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await apiService.getSolucionesStaff({
        empresa_id: empresaId,
        area:       area || undefined,
        agente_id:  agente || undefined,
        desde,
        hasta,
        q:          q || undefined,
        page,
        limit:      LIMIT,
      });
      setRows(result.rows || []);
      setTotal(result.total || 0);

      // Extraer áreas únicas del resultado para el filtro
      const uniqueAreas = [...new Set((result.rows || []).map(r => r.area).filter(Boolean))];
      if (uniqueAreas.length > 0) setAreas(prev => [...new Set([...prev, ...uniqueAreas])]);
    } catch {
      setError('No se pudieron cargar las soluciones.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, area, agente, desde, hasta, q, page]);

  // Carga inicial y cuando cambian filtros
  useEffect(() => { setPage(1); }, [empresaId, area, agente, desde, hasta, q]);
  useEffect(() => { fetchData(false); }, [fetchData]);

  // Actualización en tiempo real
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData(true);
    socket.on('conversacion_cerrada',    refresh);
    socket.on('conversacion_actualizada', refresh);
    return () => {
      socket.off('conversacion_cerrada',    refresh);
      socket.off('conversacion_actualizada', refresh);
    };
  }, [socket, fetchData]);

  const totalPages = Math.ceil(total / LIMIT);

  const resetFiltros = () => {
    setQ(''); setArea(''); setAgente('');
    setDesde(hace30()); setHasta(hoy()); setPage(1);
  };

  const hayFiltrosActivos = q || area || agente || desde !== hace30() || hasta !== hoy();

  return (
    <div className="sol-root">
      {/* ══ ENCABEZADO ══ */}
      <div className="sol-header">
        <div>
          <h1 className="sol-title">{titulo}</h1>
          <p className="sol-subtitle">
            {esAdmin
              ? 'Registro completo de todas las soluciones y notas de cierre.'
              : esCoordinador
              ? 'Conversaciones cerradas por tu equipo y las soluciones registradas.'
              : 'Tus conversaciones cerradas y las soluciones que registraste.'}
          </p>
        </div>
        {!esAsesorSimple && (
          <button
            className={`sol-filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(f => !f)}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {hayFiltrosActivos && <span className="sol-filter-dot" />}
          </button>
        )}
        {esAsesorSimple && (
          <div className="sol-filters-panel asesor-panel">
            <div className="sol-filters-grid">
              <div className="sol-filter-group">
                <label className="sol-filter-label"><Calendar size={12} /> Desde</label>
                <input type="date" className="sol-filter-input" value={desde} onChange={e => setDesde(e.target.value)} />
              </div>
              <div className="sol-filter-group">
                <label className="sol-filter-label"><Calendar size={12} /> Hasta</label>
                <input type="date" className="sol-filter-input" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
              <div className="sol-filter-group">
                <label className="sol-filter-label"><Search size={12} /> Buscar nota</label>
                <input type="text" className="sol-filter-input" placeholder="Buscar en tus notas…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ PANEL DE FILTROS ══ */}
      {showFilters && !esAsesorSimple && (
        <div className="sol-filters-panel">
          <div className="sol-filters-grid">
            {/* Búsqueda */}
            <div className="sol-filter-group">
              <label className="sol-filter-label">
                <Search size={12} /> Buscar
              </label>
              <input
                type="text"
                className="sol-filter-input"
                placeholder="Cliente, teléfono o nota de cierre…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>

                  {esAdmin && (
                    <div className="sol-filter-group">
                      <label className="sol-filter-label"><Filter size={12} /> Área</label>
                      <select className="sol-filter-select" value={area} onChange={e => setArea(e.target.value)}>
                        <option value="">Todas las áreas</option>
                        {areas.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Agente: solo coordinador y admin */}
                  {!esAsesorSimple && (
                    <div className="sol-filter-group">
                      <label className="sol-filter-label"><User size={12} /> Agente</label>
                      <select className="sol-filter-select" value={agente} onChange={e => setAgente(e.target.value)}>
                        <option value="">Todos los agentes</option>
                        {agentes.filter(a => a.rol === 'asesor').map(a => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

            {/* Fecha desde */}
            <div className="sol-filter-group">
              <label className="sol-filter-label"><Calendar size={12} /> Desde</label>
              <input type="date" className="sol-filter-input" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>

            {/* Fecha hasta */}
            <div className="sol-filter-group">
              <label className="sol-filter-label"><Calendar size={12} /> Hasta</label>
              <input type="date" className="sol-filter-input" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          </div>

          {hayFiltrosActivos && (
            <button className="sol-reset-btn" onClick={resetFiltros}>
              <X size={13} /> Limpiar filtros
            </button>
          )}
        </div>
      )}

      {error && <div className="sol-error">{error}</div>}

      {/* ══ CONTADOR ══ */}
      <div className="sol-count-row">
        <span className="sol-count">
          <CheckCircle size={14} />
          {loading ? '…' : `${total.toLocaleString()} cierres encontrados`}
        </span>
        {totalPages > 1 && (
          <div className="sol-pagination">
            <button
              className="sol-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="sol-page-label">Pág. {page} / {totalPages}</span>
            <button
              className="sol-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* ══ TABLA ══ */}
      {loading ? (
        <div className="sol-loading">
          <Loader2 className="sol-spinner" size={32} />
          <span>Cargando soluciones…</span>
        </div>
      ) : (
        <div className="sol-table-wrap">
          <div className="sol-table-scroll">
            <table className="sol-table">
              <thead>
                <tr>
                  <th className="sol-th">Fecha de Cierre</th>
                  <th className="sol-th">Agente</th>
                  {esAdmin && <th className="sol-th">Área</th>}
                  {esCoordinador && <th className="sol-th">Área</th>}
                  <th className="sol-th">Cliente</th>
                  <th className="sol-th">Categoría de Cierre</th>
                  <th className="sol-th">Nota / Solución</th>
                  <th className="sol-th">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const tipo = TIPO_LABELS[row.tipo_cierre] || TIPO_LABELS.manual;
                  return (
                    <tr key={row.id} className="sol-tr">
                      <td className="sol-td sol-date" data-label="Fecha de Cierre">{formatFecha(row.cerrado_en)}</td>

                      <td className="sol-td" data-label="Agente">
                        <div className="sol-agent-cell">
                          {row.agente_foto ? (
                            <img src={resolveAvatar(row.agente_foto)} alt={row.agente_nombre} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>
                              {(row.agente_nombre || row.cerrado_por_nombre || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="sol-agent-name">{row.agente_nombre || row.cerrado_por_nombre || '—'}</span>
                        </div>
                      </td>

                      {esAdmin && (
                        <td className="sol-td" data-label="Área">
                          <span className="sol-area-badge">{row.area || '—'}</span>
                        </td>
                      )}
                      {esCoordinador && (
                        <td className="sol-td" data-label="Área">
                          <span className="sol-area-badge">{row.area || '—'}</span>
                        </td>
                      )}

                      <td className="sol-td" data-label="Cliente">
                        <div className="sol-client-cell">
                          <span className="sol-client-name">{row.cliente_nombre || '—'}</span>
                          {row.cliente_telefono && (
                            <span className="sol-client-phone">{row.cliente_telefono}</span>
                          )}
                        </div>
                      </td>

                      <td className="sol-td" data-label="Categoría de Cierre">
                        <CategoriaBadge nombre={row.categoria_cierre} color={row.categoria_color} />
                      </td>

                      <td className="sol-td sol-nota-cell" data-label="Nota / Solución">
                        {row.comentario_cierre ? (
                          <div className="sol-nota-text" title={row.comentario_cierre}>
                            {row.comentario_cierre}
                          </div>
                        ) : (
                          <span className="sol-nota-empty">Sin notas</span>
                        )}
                      </td>

                      <td className="sol-td" data-label="Tipo">
                        <span className="sol-tipo-badge" style={{ color: tipo.color, background: tipo.bg }}>
                          {tipo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={esAdmin || esCoordinador ? 7 : 6} className="sol-empty">
                      <MessageSquare size={48} strokeWidth={1.5} />
                      <div style={{ marginTop: '8px' }}>No se encontraron cierres con los filtros actuales.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación inferior */}
      {totalPages > 1 && !loading && (
        <div className="sol-pagination sol-pagination-bottom">
          <button className="sol-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={15} /> Anterior
          </button>
          <span className="sol-page-label">Página {page} de {totalPages}</span>
          <button className="sol-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Siguiente <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SolucionesStaffView;
