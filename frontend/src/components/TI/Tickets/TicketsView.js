import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, LayoutGrid, List, RefreshCw, AlertTriangle, Wrench,
  Eye, Edit2, Clock, CheckCircle, FolderArchive, Globe, Target, User
} from 'lucide-react';
import { apiService } from '../../../services/api';
import TicketKanban from './TicketKanban';
import TicketModal from './TicketModal';
import TicketDetalleModal from './TicketDetalleModal';
import '../../../styles/ti-tickets.css';

const TicketsView = ({ user, socket, esModoGestionTI = false }) => {
  const esStaffTI = Boolean(
    esModoGestionTI && (
      user?.rol === 'admin' ||
      user?.rol === 'ti' ||
      (user?.area && (user.area.toLowerCase().includes('ti') || user.area.toLowerCase().includes('sistemas')))
    )
  );

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Filtros y pestañas
  const [tabFiltro, setTabFiltro] = useState(esStaffTI ? 'todos' : 'activos'); // 'activos' | 'resueltos' | 'todos' | 'asignados_a_mi' | 'mis_solicitudes'
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vista, setVista] = useState(esStaffTI ? 'kanban' : 'tabla'); // 'kanban' | 'tabla'

  // Modales
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [ticketParaEditar, setTicketParaEditar] = useState(null);
  const [ticketDetalleId, setTicketDetalleId] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const paramsTickets = {
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
        prioridad: filtroPrioridad !== 'todas' ? filtroPrioridad : undefined,
        estado: filtroEstado !== 'todos' ? filtroEstado : undefined,
        q: search.trim() || undefined,
      };

      if (!esStaffTI) {
        // Usuario regular: siempre y únicamente sus propios tickets
        paramsTickets.solicitante_id = user?.id;
      } else {
        if (tabFiltro === 'asignados_a_mi') {
          paramsTickets.asignado_id = user?.id;
        } else if (tabFiltro === 'mis_solicitudes') {
          paramsTickets.solicitante_id = user?.id;
        }
      }

      const paramsStats = !esStaffTI ? { solicitante_id: user?.id } : {};

      const [lista, resStats] = await Promise.all([
        apiService.getTickets(paramsTickets),
        apiService.getTicketStats(paramsStats),
      ]);
      setTickets(Array.isArray(lista) ? lista : []);
      setStats(resStats || null);
    } catch (err) {
      setError(err.message || 'Error al cargar tickets');
    } finally {
      setCargando(false);
    }
  }, [filtroTipo, filtroPrioridad, filtroEstado, search, esStaffTI, tabFiltro, user?.id]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Escuchar eventos en tiempo real via socket
  useEffect(() => {
    if (!socket) return;
    const handleTicketUpdate = () => {
      cargarDatos();
    };
    socket.on('ti:ticket_actualizado', handleTicketUpdate);
    return () => socket.off('ti:ticket_actualizado', handleTicketUpdate);
  }, [socket, cargarDatos]);

  const handleCambiarEstadoRapido = async (ticketId, nuevoEstado) => {
    try {
      await apiService.actualizarTicket(ticketId, { estado: nuevoEstado });
      cargarDatos();
    } catch (err) {
      alert(err.message || 'Error al actualizar estado');
    }
  };

  const handleEliminar = async (ticketId) => {
    try {
      await apiService.eliminarTicket(ticketId);
      cargarDatos();
    } catch (err) {
      alert(err.message || 'Error al eliminar ticket');
    }
  };

  // Filtrado local según pestaña (especialmente para usuario regular)
  const ticketsMostrados = tickets.filter(t => {
    if (!esStaffTI) {
      if (tabFiltro === 'activos') return !['resuelto', 'cancelado'].includes(t.estado);
      if (tabFiltro === 'resueltos') return ['resuelto', 'cancelado'].includes(t.estado);
    }
    return true;
  });

  return (
    <div className="ti-tickets-container">
      {/* Header superior */}
      <div className="ti-tickets-header">
        <div className="ti-tickets-header-info">
          <h2>
            <Wrench size={22} color="#DC1E1E" />
            {esStaffTI ? 'Gestión de Tickets y Solicitudes TI' : 'Soporte del Sistema - Mis Solicitudes'}
          </h2>
          <p>
            {esStaffTI
              ? 'Administra correcciones, reportes de errores, mejoras solicitadas y tareas del equipo.'
              : 'Reporta fallas técnicas, solicita mejoras y consulta el estatus y solución de tus tickets generados.'}
          </p>
        </div>

        <div className="ti-tickets-header-actions">
          <button className="btn-secondary-ticket" onClick={cargarDatos} title="Actualizar datos">
            <RefreshCw size={14} className={cargando ? 'ti-spin' : ''} />
            Actualizar
          </button>
          <button className="btn-primary-ticket" onClick={() => setModalCrearOpen(true)}>
            <Plus size={15} />
            {esStaffTI ? 'Nuevo Ticket' : 'Levantar Ticket'}
          </button>
        </div>
      </div>

      {/* Grid de Métricas / Stats */}
      <div className="ti-tickets-stats-grid">
        <div className="ti-ticket-stat-card">
          <span className="ti-stat-card-title">{esStaffTI ? 'Total Solicitudes' : 'Mis Solicitudes'}</span>
          <span className="ti-stat-card-val" style={{ color: '#0f172a' }}>{stats?.total || 0}</span>
        </div>
        <div className="ti-ticket-stat-card" style={{ borderLeft: '4px solid #94a3b8' }}>
          <span className="ti-stat-card-title">{esStaffTI ? 'Abiertos / Pendientes' : 'En Espera'}</span>
          <span className="ti-stat-card-val" style={{ color: '#475569' }}>{stats?.abiertos || 0}</span>
        </div>
        <div className="ti-ticket-stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <span className="ti-stat-card-title">En Progreso</span>
          <span className="ti-stat-card-val" style={{ color: '#0284c7' }}>{stats?.en_progreso || 0}</span>
        </div>
        <div className="ti-ticket-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <span className="ti-stat-card-title">En Revisión</span>
          <span className="ti-stat-card-val" style={{ color: '#d97706' }}>{stats?.revision || 0}</span>
        </div>
        <div className="ti-ticket-stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <span className="ti-stat-card-title">{esStaffTI ? 'Resueltos' : 'Solucionados'}</span>
          <span className="ti-stat-card-val" style={{ color: '#16a34a' }}>{stats?.resueltos || 0}</span>
        </div>
        {esStaffTI && (
          <div className="ti-ticket-stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <span className="ti-stat-card-title" style={{ color: '#dc2626' }}>Urgentes Activos</span>
            <span className="ti-stat-card-val" style={{ color: '#dc2626' }}>{stats?.urgentes || 0}</span>
          </div>
        )}
      </div>

      {/* Pestañas de Navegación Rápida */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: -4 }}>
        {!esStaffTI ? (
          <>
            <button
              type="button"
              className={`ti-view-btn ${tabFiltro === 'activos' ? 'active' : ''}`}
              style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTabFiltro('activos')}
            >
              <Clock size={14} /> Solicitudes en Atención ({((stats?.abiertos || 0) + (stats?.en_progreso || 0) + (stats?.revision || 0))})
            </button>
            <button
              type="button"
              className={`ti-view-btn ${tabFiltro === 'resueltos' ? 'active' : ''}`}
              style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTabFiltro('resueltos')}
            >
              <CheckCircle size={14} /> Historial de Resueltos ({stats?.resueltos || 0})
            </button>
            <button
              type="button"
              className={`ti-view-btn ${tabFiltro === 'todos' ? 'active' : ''}`}
              style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTabFiltro('todos')}
            >
              <FolderArchive size={14} /> Todas Mis Solicitudes ({stats?.total || 0})
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`ti-view-btn ${tabFiltro === 'todos' ? 'active' : ''}`}
              style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTabFiltro('todos')}
            >
              <Globe size={14} /> Tablero General TI ({stats?.total || 0})
            </button>
            <button
              type="button"
              className={`ti-view-btn ${tabFiltro === 'asignados_a_mi' ? 'active' : ''}`}
              style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTabFiltro('asignados_a_mi')}
            >
              <Target size={14} /> Asignados a Mí
            </button>
            <button
              type="button"
              className={`ti-view-btn ${tabFiltro === 'mis_solicitudes' ? 'active' : ''}`}
              style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTabFiltro('mis_solicitudes')}
            >
              <User size={14} /> Mis Solicitudes
            </button>
          </>
        )}
      </div>

      {/* Toolbar: Búsqueda, Filtros y Toggle de Vista */}
      <div className="ti-tickets-toolbar">
        {/* Buscador */}
        <div className="ti-tickets-search-box">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar por folio, título, solicitante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros */}
        <div className="ti-tickets-filters">
          <select className="ti-filter-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="error">Errores / Bugs</option>
            <option value="correccion">Correcciones</option>
            <option value="mejora">Mejoras</option>
            <option value="soporte">Soporte Técnico</option>
            <option value="tarea">Tareas Internas</option>
          </select>

          <select className="ti-filter-select" value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
            <option value="todas">Todas las prioridades</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>

          <select className="ti-filter-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="abierto">Abierto / Pendiente</option>
            <option value="en_progreso">En Progreso</option>
            <option value="revision">En Revisión</option>
            <option value="resuelto">Resuelto</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {/* Toggle Kanban / Tabla */}
          <div className="ti-view-toggle">
            <button
              type="button"
              className={`ti-view-btn ${vista === 'kanban' ? 'active' : ''}`}
              onClick={() => setVista('kanban')}
              title="Vista Tablero Kanban"
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              type="button"
              className={`ti-view-btn ${vista === 'tabla' ? 'active' : ''}`}
              onClick={() => setVista('tabla')}
              title="Vista Lista / Tabla"
            >
              <List size={14} /> Tabla
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Contenido según vista */}
      {cargando && tickets.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          Cargando tickets de TI...
        </div>
      ) : vista === 'kanban' ? (
        <TicketKanban
          tickets={ticketsMostrados}
          onVerDetalle={id => setTicketDetalleId(id)}
          onCambiarEstado={handleCambiarEstadoRapido}
          esModoGestionTI={esStaffTI}
        />
      ) : (
        /* Vista Tabla */
        <div className="ti-tickets-table-container">
          <table className="ti-tickets-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Título / Asunto</th>
                <th>Tipo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>{esStaffTI ? 'Solicitado por' : 'Atendido por TI'}</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ticketsMostrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#94a3b8' }}>
                    {tabFiltro === 'activos' && 'No tienes solicitudes activas en atención en este momento.'}
                    {tabFiltro === 'resueltos' && 'Aún no tienes solicitudes resueltas en tu historial.'}
                    {tabFiltro === 'todos' && 'No se encontraron tickets registrados con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                ticketsMostrados.map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setTicketDetalleId(t.id)}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>
                       {t.folio}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{t.titulo}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.descripcion}
                      </div>
                      {t.notas_resolucion && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                          Solución: {t.notas_resolucion.slice(0, 60)}{t.notas_resolucion.length > 60 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge-tipo badge-tipo-${t.tipo}`}>
                        {t.tipo}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-prioridad badge-prio-${t.prioridad}`}>
                        {t.prioridad}
                      </span>
                    </td>
                    <td>
                      <span className={`badge-estado badge-estado-${t.estado}`}>
                        {t.estado}
                      </span>
                    </td>
                    <td>
                      {esStaffTI ? (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{t.solicitante_nombre_final}</div>
                          {t.asignado_nombre && (
                            <div style={{ fontSize: 11, color: '#0284c7' }}>TI: {t.asignado_nombre}</div>
                          )}
                        </>
                      ) : (
                        t.asignado_nombre ? (
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#0284c7' }}>{t.asignado_nombre}</div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11.5, fontStyle: 'italic' }}>En cola de asignación</span>
                        )
                      )}
                    </td>
                    <td style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-secondary-ticket"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setTicketDetalleId(t.id)}
                          title="Ver detalle"
                        >
                          <Eye size={12} />
                        </button>
                        {(esStaffTI || (t.solicitante_id === user?.id && t.estado === 'abierto')) && (
                          <button
                            type="button"
                            className="btn-secondary-ticket"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => setTicketParaEditar(t)}
                            title="Editar"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear Ticket */}
      {modalCrearOpen && (
        <TicketModal
          user={user}
          onClose={() => setModalCrearOpen(false)}
          onGuardado={cargarDatos}
          esModoGestionTI={esStaffTI}
        />
      )}

      {/* Modal Editar Ticket */}
      {ticketParaEditar && (
        <TicketModal
          user={user}
          ticket={ticketParaEditar}
          onClose={() => setTicketParaEditar(null)}
          onGuardado={cargarDatos}
          esModoGestionTI={esStaffTI}
        />
      )}

      {/* Modal Detalle / Bitácora */}
      {ticketDetalleId && (
        <TicketDetalleModal
          user={user}
          ticketId={ticketDetalleId}
          onClose={() => setTicketDetalleId(null)}
          onActualizado={cargarDatos}
          onEditar={t => setTicketParaEditar(t)}
          onEliminar={handleEliminar}
          esModoGestionTI={esStaffTI}
        />
      )}
    </div>
  );
};

export default TicketsView;
