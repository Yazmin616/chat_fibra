import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Cake, Award, Bell, Pin, Plus, Trash2, Calendar, 
  Sparkles, MessageCircle, AlertCircle, RefreshCw, Send, CheckCircle2 
} from 'lucide-react';
import { apiService, resolveAvatar } from '../../services/api';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MuralComunicadosView = ({ user, onAbrirChatDirecto }) => {
  const [data, setData] = useState({
    hoy: new Date().toISOString().split('T')[0],
    mes_actual: new Date().getMonth() + 1,
    cumpleanos_hoy: [],
    cumpleanos_mes: [],
    aniversarios_mes: [],
    comunicados: [],
  });
  const [cargando, setCargando] = useState(true);
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoContenido, setNuevoContenido] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('GENERAL');
  const [esFijado, setEsFijado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const puedePublicar = 
    user?.rol === 'admin' || 
    user?.rol === 'rrhh' || 
    user?.area?.toLowerCase().includes('recursos') || 
    user?.area?.toLowerCase().includes('rh');

  const cargarResumen = async () => {
    try {
      setCargando(true);
      const res = await apiService.getResumenComunicados();
      setData(res || {});
    } catch (err) {
      console.error('Error al cargar resumen:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarResumen();
  }, []);

  const handleCrearComunicado = async (e) => {
    e.preventDefault();
    if (!nuevoTitulo.trim() || !nuevoContenido.trim()) return;

    try {
      setGuardando(true);
      await apiService.crearComunicado({
        titulo: nuevoTitulo.trim(),
        contenido: nuevoContenido.trim(),
        categoria: nuevaCategoria,
        fijado: esFijado,
        autor: user?.nombre || 'Recursos Humanos',
      });
      setModalNuevoOpen(false);
      setNuevoTitulo('');
      setNuevoContenido('');
      setNuevaCategoria('GENERAL');
      setEsFijado(false);
      await cargarResumen();
    } catch (err) {
      alert('Error al publicar el comunicado: ' + (err.message || 'Error de conexión'));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este comunicado?')) return;
    try {
      await apiService.eliminarComunicado(id);
      setData(prev => ({
        ...prev,
        comunicados: prev.comunicados.filter(c => c.id_comunicado !== id)
      }));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const getCategoriaBadge = (cat) => {
    switch (cat?.toUpperCase()) {
      case 'URGENTE':
        return { bg: '#fee2e2', color: '#dc2626', label: 'Urgente' };
      case 'EVENTO':
        return { bg: '#f3e8ff', color: '#9333ea', label: 'Evento' };
      case 'RH':
        return { bg: '#dcfce7', color: '#16a34a', label: 'Recursos Humanos' };
      case 'TI':
        return { bg: '#e0f2fe', color: '#0284c7', label: 'Sistemas / TI' };
      default:
        return { bg: '#f1f5f9', color: '#475569', label: 'General' };
    }
  };

  const fechaHoyStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="mural-container" style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      backgroundColor: '#f8fafc',
      padding: '24px 32px',
      boxSizing: 'border-box'
    }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#fff',
        marginBottom: '28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={18} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'capitalize' }}>
              {fechaHoyStr}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            ¡Buen día, {user?.nombre?.split(' ')[0] || 'Colaborador'}!
          </h1>
          <p style={{ margin: '6px 0 0', color: '#cbd5e1', fontSize: '0.95rem' }}>
            Mural corporativo de avisos, efemérides y cumpleaños de la comunidad Fibratec & Compusemmm.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', zIndex: 1 }}>
          <button
            onClick={cargarResumen}
            className="icon-btn"
            title="Recargar información"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              padding: '10px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          </button>

          {puedePublicar && (
            <button
              onClick={() => setModalNuevoOpen(true)}
              style={{
                background: '#dc2626',
                border: 'none',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
              }}
            >
              <Plus size={18} /> Publicar Aviso
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal: 2 Columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Columna Izquierda: Comunicados y Avisos */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex'
              }}>
                <Megaphone size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Avisos y Comunicados
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Publicaciones oficiales y noticias del equipo
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
              {data.comunicados?.length || 0} publicaciones
            </span>
          </div>

          {data.comunicados?.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '40px 20px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              color: '#64748b'
            }}>
              <Bell size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 600, fontSize: '1rem', color: '#334155' }}>No hay comunicados activos</div>
              <p style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>Los anuncios oficiales aparecerán en este espacio.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {data.comunicados.map(c => {
                const badge = getCategoriaBadge(c.categoria);
                return (
                  <div
                    key={c.id_comunicado}
                    style={{
                      background: '#fff',
                      borderRadius: '14px',
                      padding: '20px 24px',
                      border: c.fijado ? '2px solid #fca5a5' : '1px solid #e2e8f0',
                      boxShadow: '0 2px 10px -2px rgba(0,0,0,0.04)',
                      position: 'relative'
                    }}
                  >
                    {c.fijado && (
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#dc2626',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: '#fef2f2',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        <Pin size={12} /> FIJADO
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{
                        background: badge.bg,
                        color: badge.color,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px'
                      }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {c.fecha_publicacion} • {c.autor || 'RH'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                      {c.titulo}
                    </h3>

                    <p style={{
                      fontSize: '0.92rem',
                      color: '#334155',
                      lineHeight: 1.6,
                      margin: 0,
                      whiteSpace: 'pre-line'
                    }}>
                      {c.contenido}
                    </p>

                    {puedePublicar && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                        <button
                          onClick={() => handleEliminar(c.id_comunicado)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          <Trash2 size={13} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Cumpleaños & Aniversarios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Cumpleaños de Hoy (Si hay) */}
          {data.cumpleanos_hoy?.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '16px',
              padding: '20px 24px',
              border: '1px solid #fcd34d',
              boxShadow: '0 4px 15px -3px rgba(245, 158, 11, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: '#f59e0b', color: '#fff', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <Cake size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#78350f' }}>
                    ¡Cumpleañeros de Hoy!
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#92400e' }}>
                    Felicítalos en su día
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.cumpleanos_hoy.map(c => (
                  <div
                    key={`hoy-${c.id_usuario}`}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                        {c.nombre}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {c.puesto || c.departamento}
                      </div>
                    </div>

                    {onAbrirChatDirecto && (
                      <button
                        onClick={() => onAbrirChatDirecto(c.id_usuario)}
                        style={{
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <MessageCircle size={14} /> Felicitar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card: Cumpleaños del Mes */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px -2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fce7f3', color: '#db2777', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <Cake size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Cumpleaños de {MESES[data.mes_actual - 1] || 'este Mes'}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {data.cumpleanos_mes?.length || 0} compañeros festejan
                  </span>
                </div>
              </div>
            </div>

            {data.cumpleanos_mes?.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', margin: '20px 0' }}>
                No hay más cumpleaños registrados este mes.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                {data.cumpleanos_mes.map(c => (
                  <div
                    key={`mes-${c.id_usuario}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: c.es_hoy ? '#fef3c7' : '#f8fafc',
                      border: c.es_hoy ? '1px solid #fde68a' : '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{
                      minWidth: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: c.es_hoy ? '#f59e0b' : '#3b82f6',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      lineHeight: 1
                    }}>
                      <span>{c.dia}</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {c.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {c.puesto || c.departamento}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card: Aniversarios Laborales */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px -2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#dbeafe', color: '#2563eb', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                <Award size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Aniversarios en la Empresa
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Años de compromiso en el equipo
                </span>
              </div>
            </div>

            {data.aniversarios_mes?.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', margin: '20px 0' }}>
                No hay aniversarios registrados este mes.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                {data.aniversarios_mes.map(a => (
                  <div
                    key={`aniv-${a.id_usuario}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                        {a.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {a.puesto || a.departamento}
                      </div>
                    </div>

                    <span style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Award size={13} /> {a.anios} {a.anios === 1 ? 'año' : 'años'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modal: Publicar Comunicado (Solo Admin) */}
      {modalNuevoOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Publicar Nuevo Aviso Corporativo
            </h2>

            <form onSubmit={handleCrearComunicado} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Título del Comunicado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Horario especial de fin de año..."
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Categoría
                </label>
                <select
                  value={nuevaCategoria}
                  onChange={(e) => setNuevaCategoria(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    backgroundColor: '#fff'
                  }}
                >
                  <option value="GENERAL">General (Aviso para todos)</option>
                  <option value="RH">Recursos Humanos (RH)</option>
                  <option value="EVENTO">Evento / Convivio</option>
                  <option value="TI">Sistemas / TI (Mantenimiento)</option>
                  <option value="URGENTE">Urgente / Importante</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Contenido del Comunicado *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Escribe el mensaje que verán los colaboradores..."
                  value={nuevoContenido}
                  onChange={(e) => setNuevoContenido(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={esFijado}
                  onChange={(e) => setEsFijado(e.target.checked)}
                />
                Fijar al inicio del mural (prioritario)
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalNuevoOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#64748b',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={15} /> {guardando ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MuralComunicadosView;
