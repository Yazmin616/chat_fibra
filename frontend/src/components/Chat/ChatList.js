/**
 * @file ChatList.js
 * @description Panel izquierdo del chat: lista de conversaciones con búsqueda y filtros.
 *
 * Responsabilidades:
 *   - Mostrar la lista de conversaciones filtradas (viene pre-filtrada desde App.js).
 *   - Cuadro de búsqueda por nombre o username del cliente.
 *   - Pestañas de filtro: "Todos los chats" y "Mis Asignados".
 *   - Indicador de mensajes no leídos (burbuja roja).
 *   - Al seleccionar una conversación: actualiza el estado activo y carga los mensajes.
 *
 * Uso:
 *   <ChatList
 *     conversaciones={conversacionesFiltradas}
 *     conversacionActiva={conversacionActiva}
 *     setConversacionActiva={setConversacionActiva}
 *     cargarMensajes={cargarMensajes}
 *     busqueda={busqueda}   setBusqueda={setBusqueda}
 *     filtro={filtro}       setFiltro={setFiltro}
 *     user={user}
 *   />
 */

import React from 'react';
import { Search, MessageSquare, Clock, CheckCircle, ClipboardList, User, CheckCheck } from 'lucide-react';
import { formatConvTime } from '../../utils/formatDate';

/**
 * @param {object}   props
 * @param {object[]} props.conversaciones         - Lista de conversaciones ya filtradas.
 * @param {object|null} props.conversacionActiva  - Conversación abierta actualmente.
 * @param {Function} props.setConversacionActiva  - Setter para abrir una conversación.
 * @param {Function} props.cargarMensajes         - Carga el historial de mensajes de la conversación seleccionada.
 * @param {string}   props.busqueda               - Texto de búsqueda actual.
 * @param {Function} props.setBusqueda            - Setter del texto de búsqueda.
 * @param {string}   props.filtro                 - Filtro activo: "Todos los chats" | "Mis Asignados".
 * @param {Function} props.setFiltro              - Setter del filtro activo.
 * @param {{ rol: string }} props.user            - Agente autenticado.
 */
const ChatList = ({
  conversaciones,
  conversacionActiva,
  setConversacionActiva,
  cargarMensajes,
  busqueda,
  setBusqueda,
  filtro,
  setFiltro,
  user
}) => {
  return (
    <div className="chat-list-panel">
      <div className="search-container">
        <div className="search-box">
          <Search size={18} color="#54656f" />
          <input
            type="text"
            placeholder="Busca un chat"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        <button
          className={`tab-pill ${filtro === 'Todos los chats' ? 'active' : ''}`}
          onClick={() => setFiltro('Todos los chats')}
        >
          Pendientes
        </button>
        <button
          className={`tab-pill ${filtro === 'Mis Asignados' ? 'active' : ''}`}
          onClick={() => setFiltro('Mis Asignados')}
        >
          Mis Asignados
        </button>
        <button
          className={`tab-pill tab-pill--cerrados ${filtro === 'Cerrados' ? 'active' : ''}`}
          onClick={() => setFiltro('Cerrados')}
        >
          Cerrados
        </button>
      </div>

      <div className="conversations-list">
        {conversaciones.map((conv) => {
          const esCerrado  = conv.estado === 'cerrada' || conv.estado?.startsWith('ENCUESTA');
          const esEncuesta = conv.estado?.startsWith('ENCUESTA');

          return (
            <div
              key={conv.id}
              className={`conversation-item${conversacionActiva?.id === conv.id ? ' active' : ''}${esCerrado ? ' cerrado' : ''}`}
              onClick={() => {
                setConversacionActiva(conv);
                cargarMensajes(conv.usuario_id, conv.id);
              }}
            >
              <div className="avatar" style={{ backgroundColor: esCerrado ? '#9ca3af' : 'transparent', flexShrink: 0 }}>
                {esCerrado ? (
                  <CheckCircle size={24} color="#fff" />
                ) : (
                  <img 
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.nombre || conv.username || conv.id)}&backgroundColor=0284c7,0ea5e9,3b82f6,6366f1,8b5cf6&textColor=ffffff`} 
                    alt="avatar" 
                    style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} 
                  />
                )}
              </div>

              <div className="conv-info" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingLeft: '4px', justifyContent: 'center' }}>
                
                {/* Primera fila: Nombre y Hora */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                    <span className="client-name" style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.nombre || conv.username || 'Cliente'}
                    </span>
                    <span className="company-badge" style={{ flexShrink: 0 }}>
                      {conv.empresa_id}
                    </span>
                  </div>
                  <span className="time" style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>
                    {formatConvTime(conv.fecha_ultimo_mensaje)}
                  </span>
                </div>

                {/* Segunda fila: Mensaje y Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="last-message" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', overflow: 'hidden', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.3', flex: 1, paddingRight: '8px' }}>
                    {conv.estado === 'ESPERANDO_AGENTE' ? (
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> EN ESPERA ({conv.departamento})
                      </span>
                    ) : esEncuesta ? (
                      <span className="conv-estado-cerrado">
                        <ClipboardList size={11} /> Encuesta pendiente
                      </span>
                    ) : esCerrado ? (
                      <span className="conv-estado-cerrado">
                        {conv.ultimo_mensaje || 'Chat cerrado'}
                      </span>
                    ) : (
                      <span>
                        {conv.ultimo_remitente === 'agente' ? 'Tú: ' : ''}
                        {conv.ultimo_mensaje || 'Sin mensajes'}
                      </span>
                    )}
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: '2px' }}>
                    {!esCerrado && parseInt(conv.no_leidos) > 0 ? (
                      <div className="unread-badge-right" style={{ backgroundColor: '#25D366', color: 'white', borderRadius: '50%', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', padding: '0 4px' }}>
                        {conv.no_leidos}
                      </div>
                    ) : conv.estado === 'ESPERANDO_AGENTE' ? (
                      <Clock size={14} color="var(--text-hint)" />
                    ) : esCerrado ? (
                      <CheckCheck size={16} color="var(--text-hint)" />
                    ) : (
                      <CheckCheck size={16} color="var(--text-hint)" />
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}

        {conversaciones.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#667781', fontSize: '13px' }}>
            No hay chats en esta categoría
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
