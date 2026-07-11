import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tag, Plus, Pencil, Trash2, Search, X, Check, AlertCircle } from 'lucide-react';
import { apiService } from '../../../services/api';

// ── Utilidades exportadas (reutilizadas en el chat) ───────────────────────────

export function isColorLight(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export function EtiquetaChip({ nombre, color, area, onRemove }) {
  const isLight = isColorLight(color);
  return (
    <span className="etiqueta-chip" style={{ background: color, color: isLight ? '#111' : '#fff' }}>
      {nombre}
      {onRemove && (
        <button className="etiqueta-chip-remove" onClick={onRemove} title="Quitar">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// ── Constantes ────────────────────────────────────────────────────────────────

export const AREAS_CHAT = ['Soporte Técnico', 'Ventas', 'Cobranza'];

export const EMPRESAS_LIST = [
  { id: 'fibratec',   label: 'Fibratec' },
  { id: 'compusemmm', label: 'Compusemmm' },
];

const COLORES_PRESET = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6b7280',
];

const AREA_COLORS = {
  'General':        { bg: '#f1f5f9', text: '#475569' },
  'Soporte Técnico':{ bg: '#eff6ff', text: '#1d4ed8' },
  'Ventas':         { bg: '#f0fdf4', text: '#166534' },
  'Cobranza':       { bg: '#fff7ed', text: '#9a3412' },
};

function AreaBadge({ area }) {
  const label = area || 'General';
  const c = AREA_COLORS[label] || AREA_COLORS['General'];
  return <span className="etq-area-badge" style={{ background: c.bg, color: c.text }}>{label}</span>;
}

function EmpresaBadges({ empresas }) {
  if (!empresas?.length) return <span className="etq-no-desc">—</span>;
  if (empresas.includes('__todas__')) {
    return <span className="etq-empresa-badge etq-empresa-badge--todas">Todas</span>;
  }
  return (
    <span className="etq-empresa-badges">
      {empresas.map(id => (
        <span key={id} className="etq-empresa-badge">
          {EMPRESAS_LIST.find(e => e.id === id)?.label || id}
        </span>
      ))}
    </span>
  );
}

// Selector múltiple de empresas con "Todas"
function EmpresaSelector({ value, onChange }) {
  const todosSeleccionados = value.includes('__todas__');
  const toggleTodas = () => onChange(todosSeleccionados ? [EMPRESAS_LIST[0].id] : ['__todas__']);
  const toggleEmpresa = (id) => {
    if (todosSeleccionados) return;
    const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id];
    onChange(next.length > 0 ? next : [id]);
  };
  return (
    <div className="etq-empresa-checks">
      <label className="etq-check-option">
        <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodas} />
        <span>Todas las empresas</span>
      </label>
      {EMPRESAS_LIST.map(emp => (
        <label key={emp.id} className={`etq-check-option${todosSeleccionados ? ' etq-check-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={value.includes(emp.id) || todosSeleccionados}
            disabled={todosSeleccionados}
            onChange={() => toggleEmpresa(emp.id)}
          />
          <span>{emp.label}</span>
        </label>
      ))}
    </div>
  );
}

const EMPTY_FORM = { nombre: '', descripcion: '', color: '#3b82f6', area: '', empresas: [EMPRESAS_LIST[0].id] };

// ── Componente principal ──────────────────────────────────────────────────────

const EtiquetasSection = ({ empresaId: empresaIdProp, user }) => {
  const isAdmin = user?.rol === 'admin';

  // Filtro de la toolbar (qué empresa ver en la tabla)
  const [empresaFiltro, setEmpresaFiltro] = useState(
    empresaIdProp && empresaIdProp !== 'todas' ? empresaIdProp : 'todas'
  );
  const [areaFiltro, setAreaFiltro] = useState('todas');
  const [etiquetas,  setEtiquetas]  = useState([]);
  const [busqueda,   setBusqueda]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [form,       setForm]       = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  const [eliminando, setEliminando] = useState(null);
  const searchRef = useRef(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiService.listarEtiquetas(empresaFiltro, null, areaFiltro);
      setEtiquetas(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || 'Error al cargar etiquetas'); }
    finally { setLoading(false); }
  }, [empresaFiltro, areaFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!busqueda.trim()) { cargar(); return; }
      try {
        const data = await apiService.listarEtiquetas(empresaFiltro, busqueda, areaFiltro);
        setEtiquetas(Array.isArray(data) ? data : []);
      } catch { /* ignorar */ }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, empresaFiltro, areaFiltro, cargar]);

  const abrirFormulario = (etq = null) => {
    setFormError('');
    if (etq) {
      setForm({
        id:          etq.id,
        empresa_id:  etq.empresa_id,  // dueño original para update/delete
        nombre:      etq.nombre,
        descripcion: etq.descripcion || '',
        color:       etq.color,
        area:        etq.area || '',
        empresas:    etq.empresas || [etq.empresa_id],
      });
    } else {
      const defaultEmpresa = (!isAdmin && user?.area) ? EMPRESAS_LIST[0].id
        : (empresaFiltro !== 'todas' ? empresaFiltro : EMPRESAS_LIST[0].id);
      setForm({
        ...EMPTY_FORM,
        area:     isAdmin ? '' : (user?.area || ''),
        empresas: [defaultEmpresa],
      });
    }
  };

  const cerrarFormulario = () => { setForm(null); setFormError(''); };

  const guardar = async () => {
    if (!form.nombre?.trim())    { setFormError('El nombre es obligatorio'); return; }
    if (!form.empresas?.length)  { setFormError('Selecciona al menos una empresa'); return; }
    setSaving(true); setFormError('');
    try {
      const ownerEmpresa = form.empresa_id
        || (form.empresas.includes('__todas__') ? EMPRESAS_LIST[0].id : form.empresas[0]);
      const payload = {
        empresa_id:  ownerEmpresa,
        nombre:      form.nombre,
        descripcion: form.descripcion,
        color:       form.color,
        area:        form.area || null,
        empresas:    form.empresas,
      };
      if (form.id) {
        await apiService.actualizarEtiqueta(form.id, payload);
      } else {
        await apiService.crearEtiqueta(payload);
      }
      cerrarFormulario();
      cargar();
    } catch (e) { setFormError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const confirmarEliminar = async (id) => {
    const etq = etiquetas.find(e => e.id === id);
    try {
      await apiService.eliminarEtiqueta(id, etq?.empresa_id || EMPRESAS_LIST[0].id);
      setEliminando(null);
      cargar();
    } catch (e) {
      setError(e.message || 'Error al eliminar');
      setEliminando(null);
    }
  };

  return (
    <div className="etq-page">

      <div className="etq-page-header">
        <div className="etq-page-title">
          <Tag size={22} />
          <h2>Etiquetas</h2>
        </div>
        <p className="etq-page-desc">
          Clasifica conversaciones con etiquetas por empresa y área.
          Los agentes ven las generales + las de su área; el administrador gestiona el catálogo completo.
        </p>
      </div>

      {/* ── Toolbar de filtros ──────────────────────────────────────────────── */}
      <div className="etq-toolbar">
        {isAdmin && (
          <div className="etq-empresa-select">
            <label>Ver empresa</label>
            <select value={empresaFiltro} onChange={e => { setEmpresaFiltro(e.target.value); setBusqueda(''); }}>
              <option value="todas">Todas</option>
              {EMPRESAS_LIST.map(emp => <option key={emp.id} value={emp.id}>{emp.label}</option>)}
            </select>
          </div>
        )}

        {isAdmin && (
          <div className="etq-empresa-select">
            <label>Área</label>
            <select value={areaFiltro} onChange={e => { setAreaFiltro(e.target.value); setBusqueda(''); }}>
              <option value="todas">Todas las áreas</option>
              <option value="__general__">Solo generales</option>
              {AREAS_CHAT.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        <div className="etq-search">
          <Search size={15} />
          <input ref={searchRef} type="text" placeholder="Buscar etiqueta…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          {busqueda && <button className="etq-clear-search" onClick={() => setBusqueda('')}><X size={13} /></button>}
        </div>

        <button className="etq-btn-nueva" onClick={() => abrirFormulario()}>
          <Plus size={15} /> Nueva etiqueta
        </button>
      </div>

      {/* ── Formulario crear/editar ─────────────────────────────────────────── */}
      {form !== null && (
        <div className="etq-form-card">
          <div className="etq-form-title">{form.id ? 'Editar etiqueta' : 'Nueva etiqueta'}</div>
          <div className="etq-form-row">

            <div className="etq-form-field etq-form-field--nombre">
              <label>Nombre <span className="etq-required">*</span></label>
              <input type="text" maxLength={80} placeholder="ej. Urgente" autoFocus
                value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>

            {/* Área */}
            {isAdmin ? (
              <div className="etq-form-field etq-form-field--area">
                <label>Área</label>
                <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                  <option value="">General (todas las áreas)</option>
                  {AREAS_CHAT.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            ) : (
              <div className="etq-form-field etq-form-field--area">
                <label>Área</label>
                <div className="etq-area-readonly">
                  <AreaBadge area={user?.area || null} />
                  <span className="etq-area-readonly-hint">Se guarda en tu área automáticamente</span>
                </div>
              </div>
            )}

            {/* Empresa(s) — solo admin */}
            {isAdmin && (
              <div className="etq-form-field etq-form-field--empresas">
                <label>Empresa(s) <span className="etq-required">*</span></label>
                <EmpresaSelector
                  value={form.empresas}
                  onChange={v => setForm(f => ({ ...f, empresas: v }))}
                />
              </div>
            )}

            <div className="etq-form-field etq-form-field--desc">
              <label>Descripción (opcional)</label>
              <input type="text" maxLength={200} placeholder="Para qué se usa esta etiqueta"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div className="etq-form-field etq-form-field--color">
              <label>Color</label>
              <div className="etq-color-row">
                <input type="color" className="etq-color-picker"
                  value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
                <div className="etq-presets">
                  {COLORES_PRESET.map(c => (
                    <button key={c} className={`etq-preset${form.color === c ? ' selected' : ''}`}
                      style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} title={c} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="etq-form-preview">
            <span className="etq-form-preview-label">Vista previa:</span>
            <EtiquetaChip nombre={form.nombre || 'Nombre'} color={form.color} />
            <AreaBadge area={form.area || null} />
            {form.empresas?.length > 0 && <EmpresaBadges empresas={form.empresas} />}
          </div>

          {formError && <div className="etq-form-error"><AlertCircle size={14} /> {formError}</div>}

          <div className="etq-form-actions">
            <button className="etq-btn-cancel" onClick={cerrarFormulario} disabled={saving}>Cancelar</button>
            <button className="etq-btn-save" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : <><Check size={14} /> Guardar</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {error && <div className="etq-error-banner"><AlertCircle size={14} /> {error}</div>}

      {loading ? (
        <div className="etq-loading">Cargando…</div>
      ) : etiquetas.length === 0 ? (
        <div className="etq-empty">
          {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay etiquetas. Crea la primera.'}
        </div>
      ) : (
        <>
          {/* TABLA DE ESCRITORIO / TABLET */}
          <div className="etq-table-wrap">
            <table className="etq-table">
              <thead>
                <tr>
                  <th>Etiqueta</th>
                  <th>Empresa(s)</th>
                  <th>Área</th>
                  <th>Descripción</th>
                  {isAdmin && <th className="etq-th-actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {etiquetas.map(etq => (
                  <tr key={etq.id}>
                    <td><EtiquetaChip nombre={etq.nombre} color={etq.color} /></td>
                    <td><EmpresaBadges empresas={etq.empresas} /></td>
                    <td><AreaBadge area={etq.area} /></td>
                    <td className="etq-td-desc">{etq.descripcion || <span className="etq-no-desc">—</span>}</td>
                    {isAdmin && (
                      <td className="etq-td-actions">
                        {eliminando === etq.id ? (
                          <div className="etq-confirm-delete">
                            <span>¿Eliminar?</span>
                            <button className="etq-btn-confirm-yes" onClick={() => confirmarEliminar(etq.id)}>Sí</button>
                            <button className="etq-btn-confirm-no"  onClick={() => setEliminando(null)}>No</button>
                          </div>
                        ) : (
                          <>
                            <button className="etq-icon-btn" title="Editar" onClick={() => abrirFormulario(etq)}>
                              <Pencil size={15} />
                            </button>
                            <button className="etq-icon-btn etq-icon-btn--danger" title="Eliminar" onClick={() => setEliminando(etq.id)}>
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="etq-count">{etiquetas.length} etiqueta{etiquetas.length !== 1 ? 's' : ''}</div>
          </div>

          {/* LISTA DE TARJETAS PARA MÓVILES */}
          <div className="etq-mobile-list">
            {etiquetas.map(etq => (
              <div key={etq.id} className="etq-mobile-card">
                <div className="etq-mobile-card-header">
                  <EtiquetaChip nombre={etq.nombre} color={etq.color} />
                  <AreaBadge area={etq.area} />
                </div>
                
                <div className="etq-mobile-card-body">
                  <div className="etq-mobile-card-empresas">
                    <span className="etq-mobile-card-label">Empresa(s):</span>
                    <EmpresaBadges empresas={etq.empresas} />
                  </div>
                  {etq.descripcion && (
                    <div className="etq-mobile-card-desc">
                      <span className="etq-mobile-card-label">Descripción:</span>
                      <p>{etq.descripcion}</p>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="etq-mobile-card-actions">
                    {eliminando === etq.id ? (
                      <div className="etq-confirm-delete">
                        <span>¿Eliminar?</span>
                        <button className="etq-btn-confirm-yes" onClick={() => confirmarEliminar(etq.id)}>Sí</button>
                        <button className="etq-btn-confirm-no"  onClick={() => setEliminando(null)}>No</button>
                      </div>
                    ) : (
                      <>
                        <button className="etq-icon-btn" title="Editar" onClick={() => abrirFormulario(etq)}>
                          <Pencil size={15} />
                        </button>
                        <button className="etq-icon-btn etq-icon-btn--danger" title="Eliminar" onClick={() => setEliminando(etq.id)}>
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="etq-count" style={{ padding: '0 8px' }}>{etiquetas.length} etiqueta{etiquetas.length !== 1 ? 's' : ''}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default EtiquetasSection;
