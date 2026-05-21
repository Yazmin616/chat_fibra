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
import { Search, MessageSquare, Clock } from 'lucide-react';
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
          Todos los chats
        </button>
        <button
          className={`tab-pill ${filtro === 'Mis Asignados' ? 'active' : ''}`}
          onClick={() => setFiltro('Mis Asignados')}
        >
          Mis Asignados
        </button>
      </div>

      <div className="conversations-list">
        {conversaciones.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${conversacionActiva?.id === conv.id ? 'active' : ''}`}
            onClick={() => {
              setConversacionActiva(conv);
              cargarMensajes(conv.usuario_id, conv.id);
            }}
          >
            <div className="avatar" style={{ position: 'relative', backgroundColor: '#6b7280' }}>
              <MessageSquare size={20} color="#fff" />
              {/* Burbuja de mensajes no leídos (Simulación por ahora) */}
              {parseInt(conv.no_leidos) > 0 && <div className="unread-badge">{conv.no_leidos}</div>}
            </div>

            <div className="conv-info">
              <div className="conv-header">
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  <span className="client-name">{conv.nombre || conv.username || 'Cliente'}</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    <span className="area-label">{conv.departamento || 'Bot'}</span>
                    <span className="company-badge">{conv.empresa_id}</span>
                  </div>
                </div>
                <span className="time">
                  {formatConvTime(conv.fecha_ultimo_mensaje)}
                </span>
              </div>
              <div className="last-message">
                {conv.estado === 'ESPERANDO_AGENTE' ? (
                  <span style={{ color: '#ea4335', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> EN ESPERA ({conv.departamento})
                  </span>
                ) : (
                  <span>
                    {conv.ultimo_remitente === 'agente' ? 'Tú: ' : ''}
                    {conv.ultimo_mensaje || 'Sin mensajes'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

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
