import React from 'react';
import { 
  ChevronRight, ChevronLeft, MessageSquare, 
  User, Bug, Wrench, Sparkles, HelpCircle, ClipboardCheck
} from 'lucide-react';

const COLUMNAS = [
  { id: 'abierto',     titulo: 'Pendientes / Abiertos', className: 'col-header-abierto' },
  { id: 'en_progreso', titulo: 'En Progreso',           className: 'col-header-en_progreso' },
  { id: 'revision',    titulo: 'En Revisión / Pruebas', className: 'col-header-revision' },
  { id: 'resuelto',    titulo: 'Resueltos',             className: 'col-header-resuelto' },
];

const TIPO_ICONS = {
  error: Bug,
  correccion: Wrench,
  mejora: Sparkles,
  soporte: HelpCircle,
  tarea: ClipboardCheck,
};

const TicketKanban = ({ tickets, onVerDetalle, onCambiarEstado }) => {
  const getSiguienteEstado = (actual) => {
    if (actual === 'abierto') return 'en_progreso';
    if (actual === 'en_progreso') return 'revision';
    if (actual === 'revision') return 'resuelto';
    return null;
  };

  const getAnteriorEstado = (actual) => {
    if (actual === 'resuelto') return 'revision';
    if (actual === 'revision') return 'en_progreso';
    if (actual === 'en_progreso') return 'abierto';
    return null;
  };

  return (
    <div className="ti-kanban-board">
      {COLUMNAS.map(col => {
        const colTickets = tickets.filter(t => t.estado === col.id);

        return (
          <div key={col.id} className="ti-kanban-col">
            {/* Header de columna */}
            <div className={`ti-kanban-col-header ${col.className}`}>
              <div className="ti-kanban-col-header-title">
                <span>{col.titulo}</span>
              </div>
              <span className="ti-kanban-col-count">{colTickets.length}</span>
            </div>

            {/* Lista de tarjetas */}
            <div className="ti-kanban-cards-list">
              {colTickets.length === 0 ? (
                <div style={{ padding: '24px 10px', textAlign: 'center', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                  Sin solicitudes aquí
                </div>
              ) : (
                colTickets.map(ticket => {
                  const IconTipo = TIPO_ICONS[ticket.tipo] || Bug;
                  const sig = getSiguienteEstado(ticket.estado);
                  const ant = getAnteriorEstado(ticket.estado);

                  return (
                    <div
                      key={ticket.id}
                      className="ti-kanban-card"
                      onClick={() => onVerDetalle(ticket.id)}
                    >
                      {/* Top Row: Folio + Tipo + Prioridad */}
                      <div className="ti-card-top-row">
                        <span className="ti-card-folio">{ticket.folio}</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span className={`badge-tipo badge-tipo-${ticket.tipo}`}>
                            <IconTipo size={11} />
                            {ticket.tipo}
                          </span>
                          <span className={`badge-prioridad badge-prio-${ticket.prioridad}`}>
                            {ticket.prioridad}
                          </span>
                        </div>
                      </div>

                      {/* Título */}
                      <h4 className="ti-card-title">{ticket.titulo}</h4>

                      {/* Descripción corta */}
                      {ticket.descripcion && (
                        <p className="ti-card-desc">{ticket.descripcion}</p>
                      )}

                      {/* Footer: Solicitante y comentarios */}
                      <div className="ti-card-footer">
                        <div className="ti-card-requester" title={`Solicitado por: ${ticket.solicitante_nombre_final}`}>
                          <User size={12} color="#94a3b8" />
                          <span>{ticket.solicitante_nombre_final}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ticket.total_comentarios > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
                              <MessageSquare size={12} /> {ticket.total_comentarios}
                            </span>
                          )}

                          {/* Flechas de avance rápido */}
                          <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                            {ant && (
                              <button
                                type="button"
                                title="Retroceder estado"
                                onClick={() => onCambiarEstado(ticket.id, ant)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer', color: '#64748b' }}
                              >
                                <ChevronLeft size={13} />
                              </button>
                            )}
                            {sig && (
                              <button
                                type="button"
                                title="Avanzar estado"
                                onClick={() => onCambiarEstado(ticket.id, sig)}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer', color: '#0284c7' }}
                              >
                                <ChevronRight size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TicketKanban;
