/**
 * @file TurnosSection.js
 * @description Sección de configuración: Turnos por área con turnos múltiples + festivos + mensajes automáticos.
 *
 * Dos paneles:
 *   1. Turnos — define los turnos de cada área (herencia desde el global).
 *   2. Festivos — días no laborables (globales o por área).
 *   3. Mensajes automáticos — textos editables para escenarios A (festivo) y B (fuera de horario).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Pencil, Trash2, Globe, Folder, Info } from 'lucide-react';
import { apiService } from '../../../services/api';
import { MessageField, SectionStatus, DEFAULTS } from '../settingsUtils';

const DIAS = [
  { v: 1, l: 'Lun' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Mié' },
  { v: 4, l: 'Jue' }, { v: 5, l: 'Vie' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' },
];

const EMPRESA_ID = 'fibratec';

const TURNO_VACIO = { nombre: '', hora_inicio: '09:00', hora_fin: '18:00', dias: '1,2,3,4,5', area: null };

// ── Helpers ──────────────────────────────────────────────────────────────────

function diasSet(diasStr) {
  return new Set((diasStr || '').split(',').filter(Boolean).map(Number));
}

function diasStr(set) {
  return [...set].sort((a, b) => {
    const ord = [1, 2, 3, 4, 5, 6, 0];
    return ord.indexOf(a) - ord.indexOf(b);
  }).join(',');
}

function formatHora(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const s = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${s}` : `${h12}:${String(m).padStart(2, '0')}${s}`;
}

function labelDias(diasStr) {
  const set = diasSet(diasStr);
  if (set.size === 0) return '—';
  return DIAS.filter(d => set.has(d.v)).map(d => d.l).join(' ');
}

// ── Formulario de turno (agregar / editar) ────────────────────────────────────

function TurnoForm({ inicial, areas, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...TURNO_VACIO, ...inicial });

  const toggleDia = (v) => {
    const s = diasSet(form.dias);
    s.has(v) ? s.delete(v) : s.add(v);
    setForm(f => ({ ...f, dias: diasStr(s) }));
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const valid = form.nombre.trim() && form.hora_inicio && form.hora_fin && form.dias;

  return (
    <div className="th-form">
      <div className="th-form-row">
        <div className="th-form-group th-fg-nombre">
          <label>Nombre del turno</label>
          <input
            type="text"
            placeholder="Ej. Turno noche"
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
          />
        </div>
        <div className="th-form-group th-fg-area">
          <label>Área <span className="th-hint">(vacío = global)</span></label>
          <select value={form.area || ''} onChange={e => set('area', e.target.value || null)}>
            <option value="">Global — todas las áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="th-form-row">
        <div className="th-form-group">
          <label>Hora inicio</label>
          <input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
        </div>
        <div className="th-form-group">
          <label>Hora fin</label>
          <input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} />
        </div>
      </div>

      <div className="th-form-group">
        <label>Días de este turno</label>
        <div className="th-dias-row">
          {DIAS.map(d => {
            const on = diasSet(form.dias).has(d.v);
            return (
              <label key={d.v} className={`sc-dia${on ? ' sc-dia--on' : ''}`}>
                <input type="checkbox" style={{ display: 'none' }} checked={on} onChange={() => toggleDia(d.v)} />
                {d.l}
              </label>
            );
          })}
        </div>
      </div>

      <div className="th-form-actions">
        <button className="th-btn-cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className="btn-save" onClick={() => onSave(form)} disabled={saving || !valid}>
          {saving ? 'Guardando…' : 'Guardar turno'}
        </button>
      </div>
    </div>
  );
}

// ── Fila de un turno ──────────────────────────────────────────────────────────

function TurnoRow({ turno, onEdit, onDelete }) {
  return (
    <div className="th-turno-row">
      <div className="th-turno-nombre">{turno.nombre}</div>
      <div className="th-turno-dias">{labelDias(turno.dias)}</div>
      <div className="th-turno-horas">{formatHora(turno.hora_inicio)} – {formatHora(turno.hora_fin)}</div>
      <div className="th-turno-acciones">
        <button className="th-btn-icon" title="Editar" onClick={() => onEdit(turno)}><Pencil size={14} /></button>
        <button className="th-btn-icon th-btn-delete" title="Eliminar" onClick={() => onDelete(turno.id)}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// ── Panel de Turnos ───────────────────────────────────────────────────────────

function PanelTurnos({ areas, refreshAreas }) {
  const [turnos,    setTurnos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showing,   setShowing]   = useState(null); // null | 'new' | {turno}
  const [saving,    setSaving]    = useState(false);
  const [filtroArea, setFiltroArea] = useState('__all__');

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setTurnos(await apiService.getTurnos(EMPRESA_ID)); }
    catch { setTurnos([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (showing === 'new') {
        await apiService.crearTurno({ ...form, empresa_id: EMPRESA_ID });
      } else {
        await apiService.actualizarTurno(showing.id, form);
      }
      setShowing(null);
      await cargar();
      refreshAreas();
    } catch { /* el error se muestra en consola */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este turno?')) return;
    await apiService.eliminarTurno(id);
    await cargar();
  };

  // Agrupar por área
  const turnosFiltrados = filtroArea === '__all__'
    ? turnos
    : filtroArea === '__global__'
      ? turnos.filter(t => !t.area)
      : turnos.filter(t => t.area === filtroArea);

  const grupos = {};
  turnosFiltrados.forEach(t => {
    const key = t.area || '__global__';
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(t);
  });

  // Global siempre primero
  const ordenGrupos = Object.keys(grupos).sort((a, b) => {
    if (a === '__global__') return -1;
    if (b === '__global__') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="settings-card sc-card" style={{ marginBottom: 20 }}>
      <div className="sc-card-header">
        <div>
          <h3 className="th-subtitle">Turnos por área</h3>
          <p className="th-desc">
            Las áreas sin turno propio heredan los turnos <strong>Globales</strong>.
            Si tampoco hay globales, se usa la Jornada laboral configurada como default.
          </p>
        </div>
        <button className="btn-save" style={{ marginTop: 0 }} onClick={() => setShowing('new')}>
          + Agregar turno
        </button>
      </div>

      {/* Filtro de área */}
      <div className="th-filtro-row">
        <label>Mostrar: </label>
        <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
          <option value="__all__">Todos los turnos</option>
          <option value="__global__">Solo globales</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Formulario de nuevo turno */}
      {showing === 'new' && (
        <TurnoForm
          inicial={TURNO_VACIO}
          areas={areas}
          onSave={handleSave}
          onCancel={() => setShowing(null)}
          saving={saving}
        />
      )}

      {/* Lista de turnos por grupo */}
      {loading ? (
        <p className="th-loading">Cargando…</p>
      ) : ordenGrupos.length === 0 ? (
        <p className="th-empty">
          No hay turnos configurados. Los turnos globales aplican a todas las áreas;
          los de área específica tienen prioridad sobre los globales.
        </p>
      ) : (
        ordenGrupos.map(key => (
          <div key={key} className="th-grupo">
            <div className="th-grupo-header">
              {key === '__global__'
                ? <><Globe size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Global — todas las áreas</>
                : <><Folder size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {key}</>
              }
            </div>
            {grupos[key].map(t =>
              showing && showing !== 'new' && showing.id === t.id ? (
                <TurnoForm
                  key={t.id}
                  inicial={t}
                  areas={areas}
                  onSave={handleSave}
                  onCancel={() => setShowing(null)}
                  saving={saving}
                />
              ) : (
                <TurnoRow
                  key={t.id}
                  turno={t}
                  onEdit={setShowing}
                  onDelete={handleDelete}
                />
              )
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Panel de Festivos ─────────────────────────────────────────────────────────

function PanelFestivos({ areas }) {
  const [festivos,   setFestivos]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [mostrando,  setMostrando]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form, setForm] = useState({ fecha: '', nombre: '', area: '' });

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setFestivos(await apiService.getFestivos(EMPRESA_ID)); }
    catch { setFestivos([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCrear = async () => {
    if (!form.fecha) return;
    setSaving(true);
    try {
      await apiService.crearFestivo({ ...form, area: form.area || null, empresa_id: EMPRESA_ID });
      setForm({ fecha: '', nombre: '', area: '' });
      setMostrando(false);
      await cargar();
    } catch { /* no-op */ }
    finally { setSaving(false); }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este día festivo?')) return;
    await apiService.eliminarFestivo(id);
    await cargar();
  };

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="settings-card sc-card">
      <div className="sc-card-header">
        <div>
          <h3 className="th-subtitle">Días festivos / no laborables</h3>
          <p className="th-desc">
            En días festivos no se generan sanciones y se envía el mensaje de escenario A al cliente.
            Un festivo sin área aplica a todos los equipos.
          </p>
        </div>
        <button className="btn-save" style={{ marginTop: 0 }} onClick={() => setMostrando(v => !v)}>
          + Agregar festivo
        </button>
      </div>

      {mostrando && (
        <div className="th-form">
          <div className="th-form-row">
            <div className="th-form-group">
              <label>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div className="th-form-group">
              <label>Nombre <span className="th-hint">(opcional)</span></label>
              <input
                type="text"
                placeholder="Ej. Día de la Independencia"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="th-form-group">
              <label>Área <span className="th-hint">(vacío = todas)</span></label>
              <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                <option value="">Todas las áreas</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="th-form-actions">
            <button className="th-btn-cancel" onClick={() => setMostrando(false)}>Cancelar</button>
            <button className="btn-save" onClick={handleCrear} disabled={saving || !form.fecha}>
              {saving ? 'Guardando…' : 'Guardar festivo'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="th-loading">Cargando…</p>
      ) : festivos.length === 0 ? (
        <p className="th-empty">No hay días festivos registrados.</p>
      ) : (
        <table className="th-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre</th>
              <th>Área</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {festivos.map(f => (
              <tr key={f.id}>
                <td><strong>{formatFecha(f.fecha.slice(0, 10))}</strong></td>
                <td>{f.nombre || <span className="th-sin-nombre">—</span>}</td>
                <td>{f.area || <span className="th-todas-areas">Todas</span>}</td>
                <td>
                  <button className="th-btn-icon th-btn-delete" onClick={() => handleEliminar(f.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Panel de mensajes automáticos (A y B) ────────────────────────────────────

function PanelMensajes({ config, onSave, setDirty }) {
  const [msgFestivo,       setMsgFestivo]       = useState(config.msg_festivo       ?? DEFAULTS.msg_festivo);
  const [msgFueraHorario,  setMsgFueraHorario]  = useState(config.msg_fuera_horario ?? DEFAULTS.msg_fuera_horario);
  const [saveState, setSaveState] = useState('idle');

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await onSave('msg_festivo',       msgFestivo);
      await onSave('msg_fuera_horario', msgFueraHorario);
      setDirty(false);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const markDirty = (setter) => (val) => { setter(val); setDirty(true); };

  return (
    <div className="settings-card sc-card" style={{ marginTop: 20 }}>
      <h3 className="th-subtitle">Mensajes automáticos al cliente</h3>
      <p className="th-desc">
        Se envían automáticamente cuando llega un mensaje del cliente según la situación.
        Usa <code>{'{horarios_atencion}'}</code> para insertar los horarios generados desde los turnos.
      </p>

      {/* Escenario A */}
      <div className="sc-phase" style={{ marginBottom: 16, padding: 16, background: '#fef9c3', borderRadius: 8 }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#ca8a04' }}>A</span>
          <span className="sc-phase-name">Día festivo — nadie trabaja hoy</span>
        </div>
        <MessageField
          id="msg-festivo"
          value={msgFestivo}
          onChange={markDirty(setMsgFestivo)}
        />
      </div>

      {/* Escenario B */}
      <div className="sc-phase" style={{ marginBottom: 16, padding: 16, background: '#eff6ff', borderRadius: 8 }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#2563eb' }}>B</span>
          <span className="sc-phase-name">Fuera de horario — el área no tiene turno activo</span>
        </div>
        <MessageField
          id="msg-fuera-horario"
          value={msgFueraHorario}
          onChange={markDirty(setMsgFueraHorario)}
        />
      </div>

      <div className="sc-alert sc-alert--info">
        <Info size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} /> <strong>Escenario C (turno activo)</strong>: flujo normal del bot — sin mensaje automático de horario.
      </div>

      <div className="sc-footer">
        <SectionStatus state={saveState} />
        <button className="btn-save" disabled={saveState === 'saving'} onClick={handleSave}>
          {saveState === 'saving' ? 'Guardando…' : 'Guardar mensajes'}
        </button>
      </div>
    </div>
  );
}

// ── Componente raíz ───────────────────────────────────────────────────────────

const TurnosSection = ({ config, onSave, setDirty }) => {
  const [areas, setAreas] = useState([]);

  const cargarAreas = useCallback(async () => {
    try { setAreas(await apiService.getAreas(EMPRESA_ID)); }
    catch { setAreas([]); }
  }, []);

  useEffect(() => { cargarAreas(); }, [cargarAreas]);

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><CalendarDays size={20} /></span> Turnos y horarios por área</h2>
        <p>
          Cada área puede tener múltiples turnos con sus propios días y horarios.
          Las áreas sin turno heredan los turnos globales; si tampoco los hay, se usa la Jornada laboral.
          En días festivos y fuera de turno no se generan sanciones.
        </p>
      </div>

      <PanelTurnos areas={areas} refreshAreas={cargarAreas} />
      <PanelFestivos areas={areas} />
      <PanelMensajes config={config} onSave={onSave} setDirty={setDirty} />
    </div>
  );
};

export default TurnosSection;
