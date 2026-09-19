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
import { Search, Clock, CheckCircle, ClipboardList, CheckCheck, X } from 'lucide-react';
import { formatConvTime } from '../../utils/formatDate';
import { renderContentWithAppleEmojis } from '../../utils/appleEmojiHelper';

const cleanLastMessage = (text) => {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ');
  if (clean.length > 50) return clean.slice(0, 50) + '...';
  return clean;
};

/**
 * @param {object}   props
 * @param {object[]} props.conversaciones         - Lista de conversaciones ya filtradas.
 * @param {object|null} props.conversacionActiva  - Conversación abierta actualmente.
 * @param {Function} props.setConversacionActiva  - Setter para abrir una conversación.
 * @param {Function} props.cargarMensajes         - Carga el historial de mensajes de la conversación seleccionada.
 * @param {string}   props.busqueda               - Texto de búsqueda actual.
 * @param {Function} props.setBusqueda            - Setter del texto de búsqueda.
 * @param {string}   props.filtro                 - Filtro activo: "Todos los chats" | "Mis Asignados" | "Cerrados".
 * @param {Function} props.setFiltro              - Setter del filtro activo.
 * @param {{ rol: string }} props.user            - Agente autenticado.
 */
const ChatList = ({
  conversaciones,
  todasLasConversaciones = [],
  conversacionActiva,
  setConversacionActiva,
  cargarMensajes,
  busqueda,
  setBusqueda,
  filtro,
  setFiltro,
  user,
  empresaId
}) => {
  const ESTADOS_PURO_BOT = ['abierta', 'MENU_PRINCIPAL', 'SELECCION_EMPRESA', 'SELECCION_AREA'];

  const unreadPendientes = todasLasConversaciones.filter(c => {
    if (empresaId && empresaId !== 'todas' && c.empresa_id !== empresaId) return false;
    if (c.estado === 'cerrada' || c.estado?.startsWith('ENCUESTA')) return false;
    if (ESTADOS_PURO_BOT.includes(c.estado)) return false;
    if (user?.rol !== 'admin' && c.agente_id) return false;
    return parseInt(c.no_leidos) > 0;
  }).length;

  const unreadAsignados = todasLasConversaciones.filter(c => {
    if (empresaId && empresaId !== 'todas' && c.empresa_id !== empresaId) return false;
    if (c.estado === 'cerrada' || c.estado?.startsWith('ENCUESTA')) return false;
    if (ESTADOS_PURO_BOT.includes(c.estado)) return false;
    if (Number(c.agente_id) !== Number(user?.id)) return false;
    return parseInt(c.no_leidos) > 0;
  }).length;

  return (
    <div className="chat-list-panel wa-sidebar">
      {/* 1. Header estilo WhatsApp */}
      <div className="wa-header">
        <div className="wa-title">
          <span>Chats</span>
        </div>
      </div>

      {/* 2. Buscador WhatsApp */}
      <div className="wa-search-box">
        <div className={`wa-search-input-wrap ${busqueda ? 'has-text' : ''}`}>
          <Search size={16} className="wa-search-icon" />
          <input
            type="text"
            className="wa-search-input"
            placeholder="Buscar un chat o cliente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBusqueda('');
            }}
            spellCheck="false"
            autoComplete="off"
          />
          {busqueda && (
            <button
              type="button"
              className="wa-clear-btn"
              onClick={() => setBusqueda('')}
              title="Borrar búsqueda (Esc)"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Píldoras de Filtro estilo WhatsApp Desktop */}
      <div className="wa-chips-row">
        <button
          type="button"
          className={`wa-chip ${filtro === 'Todos los chats' ? 'active' : ''}`}
          onClick={() => setFiltro('Todos los chats')}
        >
          <span>Pendientes</span>
          {unreadPendientes > 0 && (
            <span className="wa-chip-badge">{unreadPendientes}</span>
          )}
        </button>

        <button
          type="button"
          className={`wa-chip ${filtro === 'Mis Asignados' ? 'active' : ''}`}
          onClick={() => setFiltro('Mis Asignados')}
        >
          <span>Mis Asignados</span>
          {unreadAsignados > 0 && (
            <span className="wa-chip-badge">{unreadAsignados}</span>
          )}
        </button>

        <button
          type="button"
          className={`wa-chip tab-pill--cerrados ${filtro === 'Cerrados' ? 'active' : ''}`}
          onClick={() => setFiltro('Cerrados')}
        >
          <span>Cerrados</span>
        </button>
      </div>

      {/* 4. Lista de conversaciones */}
      <div className="conversations-list wa-chat-list">
        {conversaciones.map((conv) => {
          const esCerrado  = conv.estado === 'cerrada' || conv.estado?.startsWith('ENCUESTA');
          const esEncuesta = conv.estado?.startsWith('ENCUESTA');
          const esHumano = conv.estado === 'ESPERANDO_AGENTE' || conv.estado === 'atendiendo';
          const unreadCount = esHumano && conv.estado === 'ESPERANDO_AGENTE'
            ? (parseInt(conv.no_leidos) > 0 ? conv.no_leidos : 1)
            : (esHumano && parseInt(conv.no_leidos) > 0 ? conv.no_leidos : 0);

          return (
            <div
              key={conv.id}
              className={`conversation-item wa-chat-item${conversacionActiva?.id === conv.id ? ' active' : ''}${esCerrado ? ' cerrado' : ''}`}
              onClick={() => {
                setConversacionActiva(conv);
                cargarMensajes(conv.usuario_id, conv.id);
              }}
            >
              <div className="wa-item-avatar-wrap">
                {esCerrado ? (
                  <div className="wa-item-avatar-placeholder" style={{ backgroundColor: '#9ca3af' }}>
                    <CheckCircle size={24} color="#fff" />
                  </div>
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(conv.nombre || conv.username || conv.id)}&backgroundColor=0284c7,0ea5e9,3b82f6,6366f1,8b5cf6&textColor=ffffff`}
                    alt="avatar"
                    className="wa-item-avatar-img"
                  />
                )}
              </div>

              <div className="wa-item-body">
                {/* Primera fila: Nombre, Badge Empresa/Canal y Hora */}
                <div className="wa-item-top-row">
                  <div className="wa-item-name-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <span className="wa-item-title client-name">
                      {renderContentWithAppleEmojis(conv.nombre || conv.username || 'Cliente')}
                    </span>
                    {conv.empresa_id && (
                      <span className="company-badge">
                        {conv.empresa_id}
                      </span>
                    )}
                  </div>
                  <span className="wa-item-time time">
                    {formatConvTime(conv.fecha_ultimo_mensaje)}
                  </span>
                </div>

                {/* Segunda fila: Mensaje y Badges */}
                <div className="wa-item-bottom-row">
                  <div className="wa-item-snippet wa-item-snippet-wrap last-message">
                    {conv.estado === 'ESPERANDO_AGENTE' ? (
                      <span className="wa-waiting-tag" style={{ color: '#ea580c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> En espera ({conv.departamento})
                      </span>
                    ) : esEncuesta ? (
                      <span className="conv-estado-cerrado" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ClipboardList size={12} /> Encuesta pendiente
                      </span>
                    ) : esCerrado ? (
                      <span className="conv-estado-cerrado">
                        {renderContentWithAppleEmojis(cleanLastMessage(conv.ultimo_mensaje)) || 'Chat cerrado'}
                      </span>
                    ) : (
                      <span className="wa-snippet-text">
                        {conv.ultimo_remitente === 'agente' ? 'Tú: ' : ''}
                        {renderContentWithAppleEmojis(cleanLastMessage(conv.ultimo_mensaje)) || 'Sin mensajes'}
                      </span>
                    )}
                  </div>

                  <div className="wa-item-badges-wrap">
                    {unreadCount > 0 ? (
                      <span className="wa-unread-badge">
                        {unreadCount}
                      </span>
                    ) : (
                      <CheckCheck size={16} className="wa-check-tick" color="#8696a0" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {conversaciones.length === 0 && (
          <div className="wa-empty-list-msg">
            {busqueda.trim() ? (
              <div className="wa-empty-search-wrap">
                <span>No se encontraron resultados para</span>
                <span className="wa-empty-search-term">"{busqueda}"</span>
                <button
                  type="button"
                  className="wa-empty-clear-search-btn"
                  onClick={() => setBusqueda('')}
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              'No hay chats en esta categoría'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
