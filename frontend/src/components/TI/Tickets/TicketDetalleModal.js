import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Send, Edit2, Trash2, Check
} from 'lucide-react';
import { apiService } from '../../../services/api';

const ESTADOS = [
  { id: 'abierto',     label: 'Abierto',      color: '#64748b', bg: '#f1f5f9' },
  { id: 'en_progreso', label: 'En Progreso',  color: '#0284c7', bg: '#e0f2fe' },
  { id: 'revision',    label: 'En Revisión',  color: '#d97706', bg: '#fef3c7' },
  { id: 'resuelto',    label: 'Resuelto',     color: '#16a34a', bg: '#dcfce7' },
  { id: 'cancelado',   label: 'Cancelado',    color: '#dc2626', bg: '#fee2e2' },
];

const TicketDetalleModal = ({ ticketId, onClose, onActualizado, onEditar, onEliminar, user }) => {
  const esStaffTI = Boolean(
    user?.rol === 'admin' ||
    user?.rol === 'ti' ||
    (user?.area && (user.area.toLowerCase().includes('ti') || user.area.toLowerCase().includes('sistemas')))
  );

  const [ticket, setTicket] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  
  // Comentarios
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Notas de solución inline
  const [notasResolucion, setNotasResolucion] = useState('');
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  const cargarTicket = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await apiService.getTicket(ticketId);
      setTicket(data);
      setNotasResolucion(data.notas_resolucion || '');
    } catch (err) {
      setError(err.message || 'Error al cargar detalle del ticket');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (ticketId) cargarTicket();
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarEstado = async (nuevoEstado) => {
    if (!ticket || ticket.estado === nuevoEstado) return;
    try {
      const act = await apiService.actualizarTicket(ticket.id, { estado: nuevoEstado });
      setTicket(prev => ({ ...prev, estado: act.estado, resuelto_at: act.resuelto_at, updated_at: act.updated_at }));
      onActualizado?.();
    } catch (err) {
      setError(err.message || 'Error al cambiar estado');
    }
  };

  const guardarNotasResolucion = async () => {
    if (!ticket) return;
    setGuardandoNotas(true);
    try {
      await apiService.actualizarTicket(ticket.id, { notas_resolucion: notasResolucion });
      setTicket(prev => ({ ...prev, notas_resolucion: notasResolucion }));
      onActualizado?.();
    } catch (err) {
      setError(err.message || 'Error al guardar notas');
    } finally {
      setGuardandoNotas(false);
    }
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!comentarioTexto.trim() || enviandoComentario) return;

    setEnviandoComentario(true);
    try {
      const res = await apiService.agregarComentarioTicket(ticket.id, comentarioTexto.trim());
      setTicket(prev => ({ ...prev, comentarios: res.comentarios }));
      setComentarioTexto('');
      onActualizado?.();
    } catch (err) {
      setError(err.message || 'Error al enviar comentario');
    } finally {
      setEnviandoComentario(false);
    }
  };

  if (!ticketId) return null;

  return (
    <div className="ti-modal-overlay" onClick={onClose}>
      <div className="ti-modal-card" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ti-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, color: '#334155' }}>
              {ticket?.folio || '...'}
            </span>
            <span className={`badge-tipo badge-tipo-${ticket?.tipo || 'error'}`}>
              {ticket?.tipo?.toUpperCase()}
            </span>
            <span className={`badge-prioridad badge-prio-${ticket?.prioridad || 'media'}`}>
              {ticket?.prioridad}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(esStaffTI || (ticket?.solicitante_id === user?.id && ticket?.estado === 'abierto')) && (
              <button
                className="btn-secondary-ticket"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => { onClose(); onEditar(ticket); }}
                title="Editar ticket"
              >
                <Edit2 size={13} /> Editar
              </button>
            )}
            {esStaffTI && (
              <button
                className="btn-secondary-ticket"
                style={{ padding: '4px 10px', fontSize: 12, color: '#dc2626', borderColor: '#fecaca' }}
                onClick={() => {
                  if (window.confirm(`¿Seguro que deseas eliminar el ticket ${ticket.folio}?`)) {
                    onEliminar(ticket.id);
                    onClose();
                  }
                }}
                title="Eliminar ticket"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button className="ti-modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="ti-modal-body">
          {cargando ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              Cargando información del ticket...
            </div>
          ) : error ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          ) : ticket && (
            <>
              {/* Título y descripción */}
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                  {ticket.titulo}
                </h2>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', color: '#334155', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {ticket.descripcion}
                </div>
              </div>

              {/* Selector Rápido de Estado (Pills para TI / Badge claro para usuario) */}
              {esStaffTI ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 8 }}>
                    Estado de Avance (Equipo TI)
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ESTADOS.map(st => {
                      const activo = ticket.estado === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => cambiarEstado(st.id)}
                          style={{
                            background: activo ? st.color : '#f1f5f9',
                            color: activo ? '#fff' : '#475569',
                            border: activo ? `1px solid ${st.color}` : '1px solid #cbd5e1',
                            borderRadius: 20,
                            padding: '5px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {activo && <Check size={13} />}
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>
                      Estatus Actual de tu Solicitud
                    </span>
                    <span style={{ fontSize: 13, color: '#475569', marginTop: 2, display: 'block' }}>
                      {ticket.estado === 'abierto' && 'Tu solicitud está registrada y en espera de revisión por el equipo de TI.'}
                      {ticket.estado === 'en_progreso' && 'El equipo de TI está trabajando activamente en esta solicitud.'}
                      {ticket.estado === 'revision' && 'La solución se encuentra en fase de pruebas o validación.'}
                      {ticket.estado === 'resuelto' && 'Esta solicitud ha sido resuelta con éxito por TI.'}
                      {ticket.estado === 'cancelado' && 'Esta solicitud ha sido cancelada.'}
                    </span>
                  </div>
                  <span className={`badge-estado badge-estado-${ticket.estado}`} style={{ fontSize: 13, padding: '6px 14px' }}>
                    {ticket.estado === 'abierto' ? 'Abierto' : ticket.estado === 'en_progreso' ? 'En Progreso' : ticket.estado === 'revision' ? 'En Revisión' : ticket.estado === 'resuelto' ? 'Resuelto' : 'Cancelado'}
                  </span>
                </div>
              )}

              {/* Metadatos (Solicitante, Asignado, Fechas) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12.5 }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11, fontWeight: 600 }}>SOLICITANTE</span>
                  <strong style={{ color: '#0f172a' }}>{ticket.solicitante_nombre_final}</strong>
                  {ticket.solicitante_agente_email && (
                    <span style={{ color: '#94a3b8', fontSize: 11, display: 'block' }}>{ticket.solicitante_agente_email}</span>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11, fontWeight: 600 }}>ENCARGADO TI</span>
                  <strong style={{ color: '#0f172a' }}>{ticket.asignado_nombre || 'Sin asignar'}</strong>
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11, fontWeight: 600 }}>FECHA REGISTRO</span>
                  <span style={{ color: '#334155' }}>
                    {ticket.created_at ? new Date(ticket.created_at).toLocaleString('es-MX') : '—'}
                  </span>
                </div>

                {ticket.resuelto_at && (
                  <div style={{ background: '#f0fdf4', padding: 10, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <span style={{ color: '#16a34a', display: 'block', fontSize: 11, fontWeight: 600 }}>FECHA RESOLUCIÓN</span>
                    <span style={{ color: '#15803d' }}>
                      {new Date(ticket.resuelto_at).toLocaleString('es-MX')}
                    </span>
                  </div>
                )}
              </div>

              {/* Bitácora / Notas de Solución (Editable por TI, visible destacada para usuario) */}
              {esStaffTI ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Notas de Solución Técnica / Bitácora de Cierre (TI)
                    </label>
                    <button
                      type="button"
                      onClick={guardarNotasResolucion}
                      disabled={guardandoNotas}
                      style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {guardandoNotas ? 'Guardando...' : 'Guardar Notas'}
                    </button>
                  </div>
                  <textarea
                    className="ti-form-textarea"
                    style={{ minHeight: 65, fontSize: 13 }}
                    placeholder="Detalla qué solución se implementó, archivos modificados o instrucciones para el solicitante..."
                    value={notasResolucion}
                    onChange={e => setNotasResolucion(e.target.value)}
                  />
                </div>
              ) : (
                ticket.notas_resolucion && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#15803d', fontSize: 13, marginBottom: 6 }}>
                      <Check size={16} /> Solución Aplicada por el Equipo de TI
                    </div>
                    <div style={{ color: '#166534', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {ticket.notas_resolucion}
                    </div>
                  </div>
                )
              )}

              {/* Sección de Comentarios / Historial */}
              <div className="ti-comments-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a', fontWeight: 700, fontSize: 13 }}>
                  <MessageSquare size={16} /> Comentarios y Seguimiento ({ticket.comentarios?.length || 0})
                </div>

                <div className="ti-comments-list">
                  {(!ticket.comentarios || ticket.comentarios.length === 0) ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: 8 }}>
                      No hay comentarios ni notas adicionales aún.
                    </div>
                  ) : (
                    ticket.comentarios.map(c => (
                      <div key={c.id} className="ti-comment-item">
                        <div className="ti-comment-item-top">
                          <span className="ti-comment-author">
                            {c.agente_nombre || 'Sistema TI'}
                            {c.agente_rol && (
                              <span style={{ fontSize: 10.5, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>
                                ({c.agente_rol.toUpperCase()})
                              </span>
                            )}
                          </span>
                          <span className="ti-comment-time">
                            {c.created_at ? new Date(c.created_at).toLocaleString('es-MX') : ''}
                          </span>
                        </div>
                        <p className="ti-comment-text">{c.comentario}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Input para agregar comentario */}
                <form onSubmit={enviarComentario} className="ti-comment-box">
                  <input
                    type="text"
                    className="ti-comment-input"
                    placeholder="Escribe un avance, pregunta o comentario de seguimiento..."
                    value={comentarioTexto}
                    onChange={e => setComentarioTexto(e.target.value)}
                    disabled={enviandoComentario}
                  />
                  <button
                    type="submit"
                    className="btn-primary-ticket"
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    disabled={!comentarioTexto.trim() || enviandoComentario}
                  >
                    <Send size={13} /> Enviar
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="ti-modal-footer">
          <button type="button" className="btn-secondary-ticket" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketDetalleModal;
