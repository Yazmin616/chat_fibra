import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Wrench, Bug, Sparkles, HelpCircle, ClipboardCheck } from 'lucide-react';
import { apiService } from '../../../services/api';

const TIPOS = [
  { id: 'error',      label: 'Error / Bug',          icon: Bug,          color: '#dc2626' },
  { id: 'correccion', label: 'Corrección / Ajuste',  icon: Wrench,       color: '#d97706' },
  { id: 'mejora',     label: 'Mejora / Función',     icon: Sparkles,     color: '#2563eb' },
  { id: 'soporte',    label: 'Soporte Técnico',      icon: HelpCircle,   color: '#16a34a' },
  { id: 'tarea',      label: 'Tarea Interna',        icon: ClipboardCheck,color: '#7c3aed' },
];

const PRIORIDADES = [
  { id: 'baja',    label: 'Baja' },
  { id: 'media',   label: 'Media' },
  { id: 'alta',    label: 'Alta' },
  { id: 'urgente', label: 'Urgente / Bloqueante' },
];

const ESTADOS = [
  { id: 'abierto',     label: 'Abierto / Pendiente' },
  { id: 'en_progreso', label: 'En Progreso' },
  { id: 'revision',    label: 'En Revisión' },
  { id: 'resuelto',    label: 'Resuelto' },
  { id: 'cancelado',   label: 'Cancelado' },
];

const TicketModal = ({ ticket, onClose, onGuardado, user, esModoGestionTI = false }) => {
  const esEdicion = Boolean(ticket);
  const esStaffTI = Boolean(
    esModoGestionTI && (
      user?.rol === 'admin' ||
      user?.rol === 'ti' ||
      (user?.area && (user.area.toLowerCase().includes('ti') || user.area.toLowerCase().includes('sistemas')))
    )
  );

  const [titulo, setTitulo] = useState(ticket?.titulo || '');
  const [descripcion, setDescripcion] = useState(ticket?.descripcion || '');
  const [tipo, setTipo] = useState(ticket?.tipo || 'error');
  const [prioridad, setPrioridad] = useState(ticket?.prioridad || 'media');
  const [estado, setEstado] = useState(ticket?.estado || 'abierto');
  const [solicitanteNombre, setSolicitanteNombre] = useState(ticket?.solicitante_nombre || (user ? user.nombre : ''));
  const [solicitanteId, setSolicitanteId] = useState(ticket?.solicitante_id || (user ? user.id : ''));
  const [asignadoId, setAsignadoId] = useState(ticket?.asignado_id || (esStaffTI && user ? user.id : ''));
  const [notasResolucion, setNotasResolucion] = useState(ticket?.notas_resolucion || '');

  const [agentes, setAgentes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Cargar lista de agentes para selector de solicitante y asignado si es staff TI
  useEffect(() => {
    if (esStaffTI) {
      apiService.getAgentes().then(list => {
        if (Array.isArray(list)) setAgentes(list);
      }).catch(() => {});
    }
  }, [esStaffTI]);

  const handleSeleccionarSolicitante = (e) => {
    const val = e.target.value;
    setSolicitanteId(val);
    if (val) {
      const ag = agentes.find(a => String(a.id) === String(val));
      if (ag) setSolicitanteNombre(ag.nombre);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError('Ingresa el título o resumen del ticket');
      return;
    }
    if (!descripcion.trim()) {
      setError('Ingresa la descripción o detalle de la solicitud');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      const payload = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tipo,
        prioridad,
        estado,
        solicitante_id: solicitanteId ? Number(solicitanteId) : null,
        solicitante_nombre: solicitanteNombre.trim() || null,
        asignado_id: asignadoId ? Number(asignadoId) : null,
        notas_resolucion: notasResolucion.trim() || null,
      };

      if (esEdicion) {
        await apiService.actualizarTicket(ticket.id, payload);
      } else {
        await apiService.crearTicket(payload);
      }

      onGuardado();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar ticket');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="ti-modal-overlay" onClick={onClose}>
      <div className="ti-modal-card" onClick={e => e.stopPropagation()}>
        <div className="ti-modal-header">
          <h3>
            <Wrench size={18} color="#DC1E1E" />
            {esEdicion
              ? `Editar Ticket ${ticket.folio}`
              : (esStaffTI ? 'Nuevo Ticket / Solicitud TI' : 'Levantar Ticket de Soporte al Sistema')}
          </h3>
          <button className="ti-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="ti-modal-body">
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Clasificación rápida de Tipo */}
            <div className="ti-form-group">
              <label>Tipo de Solicitud</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                {TIPOS.map(t => {
                  const Icon = t.icon;
                  const seleccionado = tipo === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipo(t.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: seleccionado ? `2px solid ${t.color}` : '1px solid #e2e8f0',
                        background: seleccionado ? '#fff' : '#f8fafc',
                        color: seleccionado ? t.color : '#64748b',
                        fontWeight: seleccionado ? 700 : 500,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon size={16} color={seleccionado ? t.color : '#94a3b8'} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Si no es personal de TI, mostrar tarjeta informativa del solicitante */}
            {!esStaffTI && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Solicitado por</span>
                  <strong style={{ color: '#0f172a' }}>{user?.nombre || 'Usuario actual'}</strong> <span style={{ color: '#64748b', fontSize: 12 }}>({user?.area || 'General'})</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Canal de Atención</span>
                  <span style={{ color: '#0284c7', fontWeight: 600, fontSize: 12 }}>Soporte TI / Sistemas</span>
                </div>
              </div>
            )}

            {/* Fila: Prioridad y Estado (si es TI se ve estado, si es regular solo prioridad) */}
            <div style={{ display: 'grid', gridTemplateColumns: esStaffTI ? '1fr 1fr' : '1fr', gap: 14 }}>
              <div className="ti-form-group">
                <label>Prioridad / Urgencia</label>
                <select className="ti-form-select" value={prioridad} onChange={e => setPrioridad(e.target.value)}>
                  {PRIORIDADES.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {esStaffTI && (
                <div className="ti-form-group">
                  <label>Estado</label>
                  <select className="ti-form-select" value={estado} onChange={e => setEstado(e.target.value)}>
                    {ESTADOS.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Título */}
            <div className="ti-form-group">
              <label>Título / Asunto corto *</label>
              <input
                type="text"
                className="ti-form-input"
                placeholder="Ej. Falla al emitir comprobante, Ajustar plantilla WhatsApp, Error de conexión..."
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                required
              />
            </div>

            {/* Descripción */}
            <div className="ti-form-group">
              <label>Descripción detallada *</label>
              <textarea
                className="ti-form-textarea"
                placeholder="Detalla qué está fallando o qué mejora necesitas, pasos para reproducir el problema o detalles de la solicitud..."
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Solicitante y Asignado (Solo visible y editable por TI / Admin) */}
            {esStaffTI && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="ti-form-group">
                  <label>Solicitado por</label>
                  <select
                    className="ti-form-select"
                    value={solicitanteId}
                    onChange={handleSeleccionarSolicitante}
                  >
                    <option value="">Ingresar texto libre o elegir agente...</option>
                    {agentes.map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} ({a.area})</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="ti-form-input"
                    style={{ marginTop: 6 }}
                    placeholder="Nombre de quien solicita"
                    value={solicitanteNombre}
                    onChange={e => setSolicitanteNombre(e.target.value)}
                  />
                </div>

                <div className="ti-form-group">
                  <label>Asignado en TI</label>
                  <select
                    className="ti-form-select"
                    value={asignadoId}
                    onChange={e => setAsignadoId(e.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {agentes.filter(a => a.rol === 'ti' || a.rol === 'admin').map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} ({a.rol.toUpperCase()})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Notas de resolución si está resuelto o es edición por TI */}
            {esStaffTI && (estado === 'resuelto' || esEdicion) && (
              <div className="ti-form-group">
                <label>Notas de Solución / Avance</label>
                <textarea
                  className="ti-form-textarea"
                  style={{ minHeight: 60 }}
                  placeholder="Explica qué solución se aplicó o comentarios de cierre..."
                  value={notasResolucion}
                  onChange={e => setNotasResolucion(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="ti-modal-footer">
            <button type="button" className="btn-secondary-ticket" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary-ticket" disabled={guardando}>
              {guardando ? 'Guardando...' : (esEdicion ? 'Guardar Cambios' : (esStaffTI ? 'Crear Ticket' : 'Enviar Solicitud a TI'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketModal;
