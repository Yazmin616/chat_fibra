import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Plus, Trash2, Save, RefreshCw,
  UserCheck, Wifi, CreditCard, ShoppingCart, Tag,
  Globe, Building2, ChevronRight, CheckCircle2, XCircle,
  Info, Zap,
} from 'lucide-react';
import { apiService } from '../../../services/api';

// ── Definición de intenciones conocidas ──────────────────────────────────────
// icon: componente Lucide  |  color/bg: paleta de la badge
// destino: área a la que redirige en el bot
const INTENCIONES = [
  {
    value:   'asesor',
    label:   'Asesor',
    icon:    UserCheck,
    desc:    'Solicitud de atención humana',
    destino: 'Cola de agentes',
    color:   '#4f46e5',
    bg:      '#eef2ff',
    border:  '#c7d2fe',
  },
  {
    value:   'soporte',
    label:   'Soporte Técnico',
    icon:    Wifi,
    desc:    'Problemas técnicos / internet',
    destino: 'Soporte Técnico',
    color:   '#d97706',
    bg:      '#fffbeb',
    border:  '#fde68a',
  },
  {
    value:   'cobranza',
    label:   'Cobranza',
    icon:    CreditCard,
    desc:    'Pagos, saldos, facturas',
    destino: 'Cobranza',
    color:   '#059669',
    bg:      '#ecfdf5',
    border:  '#a7f3d0',
  },
  {
    value:   'ventas',
    label:   'Ventas',
    icon:    ShoppingCart,
    desc:    'Contratos, planes, cotizaciones',
    destino: 'Ventas',
    color:   '#7c3aed',
    bg:      '#f5f3ff',
    border:  '#ddd6fe',
  },
];

const EMPRESA_TODAS = '__todas__';

// ── Subcomponentes ────────────────────────────────────────────────────────────

function IntencionBadge({ intencion }) {
  const info = INTENCIONES.find(i => i.value === intencion);
  const Icon = info?.icon || Tag;
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         5,
      background:  info?.bg    || '#f3f4f6',
      color:       info?.color || '#374151',
      border:      `1px solid ${info?.border || '#e5e7eb'}`,
      borderRadius: 6,
      padding:     '3px 10px',
      fontSize:    12,
      fontWeight:  600,
      flexShrink:  0,
    }}>
      <Icon size={11} />
      {info?.label || intencion}
    </span>
  );
}

function DestinoChip({ intencion }) {
  const info = INTENCIONES.find(i => i.value === intencion);
  if (!info?.destino) return null;
  return (
    <span style={{
      display:    'inline-flex',
      alignItems: 'center',
      gap:        3,
      fontSize:   11,
      color:      '#9ca3af',
    }}>
      <ChevronRight size={10} />
      {info.destino}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

function PalabrasClaveBotSection({ setDirty }) {
  const [reglas,    setReglas]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [editando,  setEditando]  = useState({});
  const [nueva,     setNueva]     = useState({ empresa_id: EMPRESA_TODAS, intencion: 'asesor', palabras: '' });
  const [msg,       setMsg]       = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getPalabrasClave();
      setReglas(data);
    } catch {
      setMsg({ tipo: 'error', texto: 'Error al cargar reglas' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostrarMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 3500);
  };

  const handleGuardar = async (regla) => {
    const textoEditado = editando[regla.id];
    if (textoEditado === undefined) return;
    const palabras = textoEditado.split(',').map(p => p.trim()).filter(Boolean);
    if (!palabras.length) return mostrarMsg('error', 'Escribe al menos una palabra clave.');

    setGuardando(regla.id);
    try {
      await apiService.actualizarPalabraClave(regla.id, { palabras, activo: regla.activo });
      setEditando(prev => { const n = { ...prev }; delete n[regla.id]; return n; });
      await cargar();
      mostrarMsg('ok', 'Regla actualizada');
      setDirty && setDirty(false);
    } catch {
      mostrarMsg('error', 'Error al guardar');
    } finally {
      setGuardando(null);
    }
  };

  const handleToggle = async (regla) => {
    try {
      await apiService.actualizarPalabraClave(regla.id, {
        palabras: regla.palabras,
        activo:   !regla.activo,
      });
      await cargar();
    } catch {
      mostrarMsg('error', 'Error al actualizar');
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta regla?')) return;
    try {
      await apiService.eliminarPalabraClave(id);
      await cargar();
      mostrarMsg('ok', 'Regla eliminada');
    } catch {
      mostrarMsg('error', 'Error al eliminar');
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    const palabras = nueva.palabras.split(',').map(p => p.trim()).filter(Boolean);
    if (!palabras.length) return mostrarMsg('error', 'Escribe al menos una palabra clave.');
    try {
      await apiService.crearPalabraClave({ ...nueva, palabras });
      setNueva({ empresa_id: EMPRESA_TODAS, intencion: 'asesor', palabras: '' });
      await cargar();
      mostrarMsg('ok', 'Regla creada');
    } catch (err) {
      mostrarMsg('error', err?.message || 'Error al crear regla');
    }
  };

  const porEmpresa = reglas.reduce((acc, r) => {
    if (!acc[r.empresa_id]) acc[r.empresa_id] = [];
    acc[r.empresa_id].push(r);
    return acc;
  }, {});

  return (
    <div className="plt-root">

      {/* ── Cabecera ── */}
      <div className="settings-header">
        <div>
          <h2>Palabras clave del bot</h2>
          <p>Define qué frases activan cada intención. Separa las palabras con comas.</p>
        </div>
        <button className="btn-save" onClick={cargar} style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={15} /> Recargar
        </button>
      </div>

      {msg && (
        <div className={`cfg-alert cfg-alert--${msg.tipo === 'ok' ? 'success' : 'error'}`}>
          {msg.texto}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#667781', padding: '24px 0' }}>Cargando reglas...</p>
      ) : (
        <>
          {/* ── Reglas existentes agrupadas por empresa ── */}
          {Object.entries(porEmpresa).map(([eid, lista]) => (
            <div key={eid} className="plt-editor" style={{ marginBottom: 24 }}>

              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {eid === EMPRESA_TODAS
                  ? <><Globe size={13} color="#4f46e5" /> Todas las empresas (global)</>
                  : <><Building2 size={13} color="#374151" /> {eid}</>
                }
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lista.map(regla => {
                  const textoActual = editando[regla.id] !== undefined
                    ? editando[regla.id]
                    : regla.palabras.join(', ');
                  const editado = editando[regla.id] !== undefined;

                  return (
                    <div
                      key={regla.id}
                      style={{
                        background:   '#f8f9fa',
                        border:       `1px solid ${editado ? '#94a3b8' : '#e5e7eb'}`,
                        borderRadius: 8,
                        padding:      '12px 14px',
                        opacity:      regla.activo ? 1 : 0.55,
                        transition:   'border-color 0.15s',
                      }}
                    >
                      {/* Fila superior: badge + destino + acciones */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <IntencionBadge intencion={regla.intencion} />
                        <DestinoChip   intencion={regla.intencion} />

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Toggle activo/inactivo */}
                          <button
                            className="agent-edit-tab"
                            style={{
                              padding:    '3px 10px',
                              fontSize:   12,
                              display:    'flex',
                              alignItems: 'center',
                              gap:        4,
                              background: regla.activo ? '#dcfce7' : '#f9fafb',
                              color:      regla.activo ? '#16a34a' : '#6b7280',
                            }}
                            title={regla.activo ? 'Desactivar' : 'Activar'}
                            onClick={() => handleToggle(regla)}
                          >
                            {regla.activo
                              ? <><CheckCircle2 size={12} /> Activa</>
                              : <><XCircle      size={12} /> Inactiva</>
                            }
                          </button>

                          {/* Eliminar */}
                          <button
                            className="agent-edit-tab"
                            style={{ padding: '3px 8px' }}
                            title="Eliminar regla"
                            onClick={() => handleEliminar(regla.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Textarea de palabras clave */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <textarea
                          rows={2}
                          style={{
                            flex:       1,
                            fontSize:   13,
                            padding:    '6px 8px',
                            border:     `1px solid ${editado ? '#94a3b8' : '#d1d5db'}`,
                            borderRadius: 6,
                            resize:     'vertical',
                            fontFamily: 'inherit',
                            background: '#fff',
                          }}
                          value={textoActual}
                          onChange={e => {
                            setEditando(prev => ({ ...prev, [regla.id]: e.target.value }));
                            setDirty && setDirty(true);
                          }}
                          placeholder="falla, sin internet, problema, ..."
                        />
                        {editado && (
                          <button
                            className="btn-save"
                            style={{ alignSelf: 'flex-start', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                            disabled={guardando === regla.id}
                            onClick={() => handleGuardar(regla)}
                          >
                            {guardando === regla.id ? '...' : <><Save size={13} /> Guardar</>}
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        Separa con comas. El bot detecta la intención si el mensaje <em>contiene</em> alguna de estas palabras (sin importar acentos o mayúsculas).
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── Crear nueva regla ── */}
          <div className="plt-editor" style={{ marginTop: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={13} /> Nueva regla
            </h3>
            <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Empresa</label>
                  <input
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    value={nueva.empresa_id}
                    onChange={e => setNueva(p => ({ ...p, empresa_id: e.target.value }))}
                    placeholder="__todas__ o id-empresa"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Intención</label>
                  <select
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    value={nueva.intencion}
                    onChange={e => setNueva(p => ({ ...p, intencion: e.target.value }))}
                  >
                    {INTENCIONES.map(i => (
                      <option key={i.value} value={i.value}>{i.label} — {i.desc}</option>
                    ))}
                    <option value="custom">Personalizada…</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Palabras clave (separadas por comas)</label>
                <input
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                  value={nueva.palabras}
                  onChange={e => setNueva(p => ({ ...p, palabras: e.target.value }))}
                  placeholder="Ej: soporte, falla, sin internet, problema técnico"
                  required
                />
              </div>
              <button type="submit" className="btn-save" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Crear regla
              </button>
            </form>
          </div>

          {/* ── Panel informativo de intenciones ── */}
          <div style={{ marginTop: 24, padding: '14px 16px', background: '#f8faff', borderRadius: 8, border: '1px solid #e0e7ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Bot size={15} color="#4f46e5" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4338ca' }}>Cómo funcionan las intenciones</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INTENCIONES.map(i => {
                const Icon = i.icon;
                return (
                  <div key={i.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display:     'inline-flex',
                      alignItems:  'center',
                      gap:         5,
                      background:  i.bg,
                      color:       i.color,
                      border:      `1px solid ${i.border}`,
                      borderRadius: 6,
                      padding:     '2px 9px',
                      fontSize:    12,
                      fontWeight:  600,
                      minWidth:    110,
                    }}>
                      <Icon size={11} /> {i.label}
                    </span>
                    <ChevronRight size={11} color="#9ca3af" />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{i.destino}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>— {i.desc}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e0e7ff' }}>
              <Info size={13} color="#6366f1" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#6366f1', margin: 0, lineHeight: 1.5 }}>
                Las reglas por empresa tienen prioridad sobre las globales (<code>__todas__</code>).
                El bot normaliza el texto del cliente (sin acentos, sin mayúsculas) antes de comparar,
                por lo que "INTERNET" e "internét" se detectan igual.
                El caché se refresca automáticamente cada 5 minutos.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
              <Zap size={13} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                Cuando el bot detecta una intención pide confirmación antes de enrutar.
                Si el mensaje coincide con varias intenciones a la vez, muestra un menú con las opciones detectadas.
                Tras 3 mensajes no reconocidos, escala automáticamente a un asesor.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PalabrasClaveBotSection;
