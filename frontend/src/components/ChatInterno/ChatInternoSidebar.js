import React, { useState, useMemo } from 'react';
import {
  Hash, Lock, Plus, Search, Pin,
  Check, CheckCheck, MoreVertical, X,
  Camera, Mic, FileText, Video, Sticker,
  Sun, Moon
} from 'lucide-react';
import { resolveAvatar } from '../../services/api';
import CrearGrupoWhatsAppDrawer from './CrearGrupoWhatsAppDrawer';
import { renderContentWithAppleEmojis, renderAppleEmoji } from '../../utils/appleEmojiHelper';
import { durationCache, formatDur } from './ChatInternoAudioPlayer';
import { getPresenciaInfo } from '../../utils/presenceHelper';

// Helper para renderizar el contenido del último mensaje estilo WhatsApp Web
const renderSnippetBody = (msg) => {
  if (!msg) return null;

  // Deducir tipo si no viene explícito o si viene como texto con adjunto
  let tipo = msg.tipo;
  if (!tipo || tipo === 'texto') {
    if (msg.url_adjunto) {
      const url = msg.url_adjunto.toLowerCase();
      if (url.startsWith('st://') || url.includes('/stickers/')) {
        tipo = 'sticker';
      } else if (url.includes('/chat-interno/voz_') || url.endsWith('.webm') || url.endsWith('.ogg') || url.endsWith('.mp3')) {
        tipo = 'audio';
      } else if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.gif') || url.endsWith('.webp')) {
        tipo = 'imagen';
      } else if (url.endsWith('.mp4') || url.endsWith('.mov')) {
        tipo = 'video';
      } else {
        tipo = 'archivo';
      }
    } else {
      tipo = 'texto';
    }
  }

  if (tipo === 'sticker') {
    return (
      <span className="wa-snippet-media-label">
        <Sticker size={13} className="wa-snippet-inline-icon" />
        <span>Sticker</span>
      </span>
    );
  }

  if (tipo === 'audio' || tipo === 'voice') {
    let durText = '0:07';
    if (msg.mensaje && /^\d+:\d{2}$/.test(msg.mensaje.trim())) {
      durText = msg.mensaje.trim();
    } else if (msg.url_adjunto && durationCache.has(msg.url_adjunto)) {
      durText = formatDur(durationCache.get(msg.url_adjunto));
    } else if (msg.duracion && isFinite(msg.duracion)) {
      durText = formatDur(msg.duracion);
    }

    return (
      <span className="wa-snippet-media-label wa-snippet-voice">
        <Mic size={14} className="wa-snippet-voice-mic" color="#00a884" fill="#00a884" />
        <span className="wa-snippet-voice-dur">{durText}</span>
      </span>
    );
  }

  if (tipo === 'imagen') {
    return (
      <span className="wa-snippet-media-label">
        <Camera size={13} className="wa-snippet-inline-icon" />
        <span>{renderContentWithAppleEmojis(msg.mensaje?.trim() || 'Foto', '1.15em')}</span>
      </span>
    );
  }

  if (tipo === 'video') {
    return (
      <span className="wa-snippet-media-label">
        <Video size={13} className="wa-snippet-inline-icon" />
        <span>{renderContentWithAppleEmojis(msg.mensaje?.trim() || 'Video', '1.15em')}</span>
      </span>
    );
  }

  if (tipo === 'archivo') {
    return (
      <span className="wa-snippet-media-label">
        <FileText size={13} className="wa-snippet-inline-icon" />
        <span>{renderContentWithAppleEmojis(msg.mensaje?.trim() || msg.nombre_adjunto || 'Archivo', '1.15em')}</span>
      </span>
    );
  }

  return <span>{renderContentWithAppleEmojis(msg.mensaje || 'Mensaje', '1.15em')}</span>;
};

// Helper para renderizar el snippet de reacciones estilo WhatsApp Web
const renderReactionSnippet = (reac, userActual, isGroup = false) => {
  if (!reac) return null;

  const isMyReaction = Number(reac.agente_id) === Number(userActual?.id);
  const isToMyMessage = Number(reac.mensaje_emisor_id) === Number(userActual?.id);

  let targetDesc = 'un mensaje';
  if (isToMyMessage) {
    targetDesc = 'tu mensaje';
  }
  if (reac.mensaje_tipo === 'sticker') {
    targetDesc = isToMyMessage ? 'tu sticker' : 'el sticker';
  } else if (reac.mensaje_tipo === 'audio' || reac.mensaje_tipo === 'voice') {
    targetDesc = isToMyMessage ? 'tu nota de voz' : 'la nota de voz';
  } else if (reac.mensaje_tipo === 'imagen') {
    targetDesc = isToMyMessage ? 'tu foto' : 'la foto';
  } else if (reac.mensaje_tipo === 'video') {
    targetDesc = isToMyMessage ? 'tu video' : 'el video';
  } else if (reac.mensaje_tipo === 'archivo') {
    targetDesc = isToMyMessage ? 'tu archivo' : 'el archivo';
  } else if (reac.mensaje_texto?.trim()) {
    const clean = reac.mensaje_texto.trim();
    const snippet = clean.length > 18 ? `${clean.substring(0, 18)}...` : clean;
    targetDesc = isToMyMessage ? 'tu mensaje' : `"${snippet}"`;
  }

  // Si reaccionó el usuario actual
  if (isMyReaction) {
    return (
      <span className="wa-snippet-reaction-wrap">
        <span className="wa-snippet-reaction-emoji">{renderAppleEmoji(reac.emoji, '1.15em')}</span>
        <span>{renderContentWithAppleEmojis(`Reaccionaste a ${targetDesc}`, '1.15em')}</span>
      </span>
    );
  }

  // Alguien más reaccionó en grupo
  if (isGroup) {
    const nombre = reac.agente_nombre?.split(' ')[0] || 'Alguien';
    return (
      <span className="wa-snippet-reaction-wrap">
        <span className="wa-snippet-reaction-emoji">{renderAppleEmoji(reac.emoji, '1.15em')}</span>
        <span>{renderContentWithAppleEmojis(`${nombre} reaccionó a ${targetDesc}`, '1.15em')}</span>
      </span>
    );
  }

  // Alguien más reaccionó en chat directo
  return (
    <span className="wa-snippet-reaction-wrap">
      <span className="wa-snippet-reaction-emoji">{renderAppleEmoji(reac.emoji, '1.15em')}</span>
      <span>{renderContentWithAppleEmojis(`Reaccionó a ${targetDesc}`, '1.15em')}</span>
    </span>
  );
};

// Función para dar formato a la hora o fecha estilo WhatsApp Web
const formatWhatsAppTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  
  // Mismo día
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Ayer
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  }

  // Últimos 7 días
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 6) {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return days[date.getDay()];
  }

  // Fecha regular
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const ChatInternoSidebar = ({
  canales = [],
  contactos = [],
  canalActivo,
  mensajesActivos = [],
  escribiendoMap = {},
  onSeleccionarCanal,
  onAbrirDirecto,
  onAbrirModalCrearCanal,
  onToggleFijar,
  userActual,
  crearGrupoOpen = false,
  onCloseCrearGrupo,
  onCrearGrupo,
  isDark = false,
  onToggleTheme,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroChip, setFiltroChip] = useState('todos'); // 'todos' | 'no_leidos' | 'favoritos' | 'grupos'
  const [showMenu, setShowMenu] = useState(false);

  // Separar canales grupales y chats directos (deduplicando por ID)
  const canalesGrupales = useMemo(() => {
    const seen = new Set();
    return canales.filter(c => {
      if (c.tipo !== 'canal') return false;
      const cid = Number(c.id);
      if (seen.has(cid)) return false;
      seen.add(cid);
      return true;
    });
  }, [canales]);

  const chatsDirectos = useMemo(() => {
    const seen = new Set();
    return canales.filter(c => {
      if (c.tipo !== 'directo') return false;
      const cid = Number(c.id);
      if (seen.has(cid)) return false;
      seen.add(cid);
      return true;
    });
  }, [canales]);

  // Totales para las píldoras de filtro
  const unreadTotal = useMemo(() => {
    const unreadCanales = canalesGrupales.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    const unreadDirectos = chatsDirectos.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    return unreadCanales + unreadDirectos;
  }, [canalesGrupales, chatsDirectos]);

  const favoritosTotal = useMemo(() => {
    const favCanales = canalesGrupales.filter(c => c.fijado).length;
    const favDirectos = chatsDirectos.filter(c => c.fijado).length;
    return favCanales + favDirectos;
  }, [canalesGrupales, chatsDirectos]);

  // Filtrado por texto
  const term = busqueda.toLowerCase().trim();

  // Lista unificada de todos los chats (canales grupales y directos/contactos)
  // ordenada estrictamente de más reciente a más antigua (estilo WhatsApp)
  const chatsUnificados = useMemo(() => {
    // 1. Canales grupales
    const itemsCanales = canalesGrupales.map(canal => {
      const isCanalActive = canalActivo?.tipo === 'canal' && Number(canalActivo?.id) === Number(canal.id);
      const lastMsg = (isCanalActive && mensajesActivos && mensajesActivos.length > 0)
        ? mensajesActivos[mensajesActivos.length - 1]
        : canal.ultimo_mensaje;
      const ultimaReac = canal.ultima_reaccion;
      const isReactionLatest = Boolean(
        ultimaReac &&
        (!lastMsg || new Date(ultimaReac.created_at).getTime() >= new Date(lastMsg.created_at).getTime())
      );

      let timestamp = 0;
      if (isReactionLatest && ultimaReac?.created_at) {
        timestamp = new Date(ultimaReac.created_at).getTime();
      } else if (lastMsg?.created_at) {
        timestamp = new Date(lastMsg.created_at).getTime();
      } else if (canal.created_at) {
        timestamp = new Date(canal.created_at).getTime();
      }

      return {
        tipoItem: 'canal',
        id: `canal-${canal.id}`,
        canal,
        isPinned: Boolean(canal.fijado),
        timestamp,
        unreadCount: canal.unread_count || 0,
        nombre: canal.nombre || '',
        lastMsg,
        ultimaReac,
        isReactionLatest,
      };
    });

    // 2. Contactos y chats directos
    const contactosIds = new Set();
    const itemsDirectos = contactos.map(contacto => {
      contactosIds.add(Number(contacto.id));
      const directCanal = chatsDirectos.find(
        c => Number(c.otro_participante?.id) === Number(contacto.id)
      );
      const isDirectActive = canalActivo?.tipo === 'directo' && (
        Number(canalActivo?.otro_participante?.id) === Number(contacto.id) ||
        (directCanal && Number(canalActivo?.id) === Number(directCanal.id))
      );
      const lastMsg = (isDirectActive && mensajesActivos && mensajesActivos.length > 0)
        ? mensajesActivos[mensajesActivos.length - 1]
        : directCanal?.ultimo_mensaje;
      const ultimaReac = directCanal?.ultima_reaccion;
      const isReactionLatest = Boolean(
        ultimaReac &&
        (!lastMsg || new Date(ultimaReac.created_at).getTime() >= new Date(lastMsg.created_at).getTime())
      );

      let timestamp = 0;
      if (isReactionLatest && ultimaReac?.created_at) {
        timestamp = new Date(ultimaReac.created_at).getTime();
      } else if (lastMsg?.created_at) {
        timestamp = new Date(lastMsg.created_at).getTime();
      } else if (directCanal?.created_at && lastMsg) {
        timestamp = new Date(directCanal.created_at).getTime();
      }

      return {
        tipoItem: 'directo',
        id: `contacto-${contacto.id}`,
        contacto,
        directCanal,
        isPinned: Boolean(directCanal?.fijado),
        timestamp,
        unreadCount: directCanal?.unread_count || 0,
        nombre: contacto.nombre || '',
        lastMsg,
        ultimaReac,
        isReactionLatest,
      };
    });

    // Añadir cualquier chat directo que no esté en la lista de contactos
    chatsDirectos.forEach(directCanal => {
      const otroId = Number(directCanal.otro_participante?.id);
      if (otroId && !contactosIds.has(otroId)) {
        contactosIds.add(otroId);
        const isDirectActive = canalActivo?.tipo === 'directo' && Number(canalActivo?.id) === Number(directCanal.id);
        const lastMsg = (isDirectActive && mensajesActivos && mensajesActivos.length > 0)
          ? mensajesActivos[mensajesActivos.length - 1]
          : directCanal.ultimo_mensaje;
        const ultimaReac = directCanal.ultima_reaccion;
        const isReactionLatest = Boolean(
          ultimaReac &&
          (!lastMsg || new Date(ultimaReac.created_at).getTime() >= new Date(lastMsg.created_at).getTime())
        );

        let timestamp = 0;
        if (isReactionLatest && ultimaReac?.created_at) {
          timestamp = new Date(ultimaReac.created_at).getTime();
        } else if (lastMsg?.created_at) {
          timestamp = new Date(lastMsg.created_at).getTime();
        } else if (directCanal.created_at) {
          timestamp = new Date(directCanal.created_at).getTime();
        }

        itemsDirectos.push({
          tipoItem: 'directo',
          id: `canal-directo-${directCanal.id}`,
          contacto: directCanal.otro_participante,
          directCanal,
          isPinned: Boolean(directCanal.fijado),
          timestamp,
          unreadCount: directCanal.unread_count || 0,
          nombre: directCanal.otro_participante?.nombre || 'Contacto',
          lastMsg,
          ultimaReac,
          isReactionLatest,
        });
      }
    });

    // 3. Filtrar
    const todos = [...itemsCanales, ...itemsDirectos].filter(item => {
      // Filtros por pestaña
      if (filtroChip === 'grupos' && item.tipoItem !== 'canal') return false;
      if (filtroChip === 'no_leidos' && (item.unreadCount || 0) <= 0) return false;
      if (filtroChip === 'favoritos' && !item.isPinned) return false;

      // Filtro de texto
      if (term) {
        if (item.tipoItem === 'canal') {
          const matchNombre = (item.canal.nombre || '').toLowerCase().includes(term);
          const matchDesc = (item.canal.descripcion || '').toLowerCase().includes(term);
          const matchMsg = (item.lastMsg?.mensaje || '').toLowerCase().includes(term);
          if (!matchNombre && !matchDesc && !matchMsg) return false;
        } else {
          const matchNombre = (item.contacto?.nombre || '').toLowerCase().includes(term);
          const matchArea = (item.contacto?.area || '').toLowerCase().includes(term);
          const matchMsg = (item.lastMsg?.mensaje || '').toLowerCase().includes(term);
          if (!matchNombre && !matchArea && !matchMsg) return false;
        }
      }

      return true;
    });

    // 4. Ordenar: Fijados primero, y de más reciente a más antigua
    return todos.sort((a, b) => {
      // Pinned items primero
      const fijadoA = a.isPinned ? 1 : 0;
      const fijadoB = b.isPinned ? 1 : 0;
      if (fijadoB !== fijadoA) return fijadoB - fijadoA;

      // De más reciente a más antigua (timestamp descendente)
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }

      // Si ninguno tiene actividad (contactos de directorio sin mensajes previos)
      if (a.tipoItem === 'directo' && b.tipoItem === 'directo') {
        const onlineA = a.contacto?.esta_online ? 1 : 0;
        const onlineB = b.contacto?.esta_online ? 1 : 0;
        if (onlineB !== onlineA) return onlineB - onlineA;
      }

      // Desempate alfabético
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
  }, [canalesGrupales, chatsDirectos, contactos, canalActivo, mensajesActivos, term, filtroChip]);

  return (
    <aside className="ci-sidebar wa-sidebar" style={{ position: 'relative' }}>
      {/* Drawer para Crear Grupo estilo WhatsApp Desktop */}
      {crearGrupoOpen && (
        <CrearGrupoWhatsAppDrawer
          contactos={contactos}
          userActual={userActual}
          onCrear={onCrearGrupo}
          onClose={onCloseCrearGrupo}
        />
      )}

      {/* 1. Header estilo WhatsApp */}
      <div className="ci-sidebar-header wa-header">
        <div className="ci-sidebar-title wa-title">
          <span>Chats</span>
        </div>

        <div className="wa-header-actions">
          {/* Botón Nuevo Canal / Chat */}
          <button
            className="ci-btn-icon wa-icon-btn"
            title="Nuevo canal o conversación"
            onClick={onAbrirModalCrearCanal}
          >
            <Plus size={20} />
          </button>

          {/* Menú de opciones (3 puntos) */}
          <div style={{ position: 'relative' }}>
            <button
              className="ci-btn-icon wa-icon-btn"
              title="Menú de opciones"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical size={19} />
            </button>

            {showMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setShowMenu(false)}
                />
                <div className="wa-dropdown-menu">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onAbrirModalCrearCanal && onAbrirModalCrearCanal();
                    }}
                  >
                    Nuevo grupo o canal
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setFiltroChip('no_leidos');
                    }}
                  >
                    Ver mensajes no leídos
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setFiltroChip('todos');
                    }}
                  >
                    Restablecer filtros
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onToggleTheme) onToggleTheme();
                      setShowMenu(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    {isDark ? <Sun size={15} /> : <Moon size={15} />}
                    <span>{isDark ? 'Tema claro' : 'Tema oscuro'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Buscador estilo WhatsApp */}
      <div className="ci-search-box wa-search-box">
        <div className={`ci-search-input-wrap wa-search-input-wrap ${busqueda ? 'has-text' : ''}`}>
          <Search size={16} className="wa-search-icon" />
          <input
            type="text"
            className="wa-search-input"
            placeholder="Buscar un chat o iniciar uno nuevo"
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
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Píldoras de Filtro (Chips) estilo WhatsApp */}
      <div className="wa-chips-row">
        {/* Chip Todos */}
        <button
          type="button"
          className={`wa-chip ${filtroChip === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltroChip('todos')}
        >
          Todos
        </button>

        {/* Chip No leídos */}
        <button
          type="button"
          className={`wa-chip ${filtroChip === 'no_leidos' ? 'active' : ''}`}
          onClick={() => setFiltroChip('no_leidos')}
        >
          <span>No leídos</span>
          {unreadTotal > 0 && (
            <span className="wa-chip-badge">{unreadTotal}</span>
          )}
        </button>

        {/* Chip Favoritos */}
        <button
          type="button"
          className={`wa-chip ${filtroChip === 'favoritos' ? 'active' : ''}`}
          onClick={() => setFiltroChip('favoritos')}
        >
          <span>Favoritos</span>
          {favoritosTotal > 0 && (
            <span className="wa-chip-badge-neutral">{favoritosTotal}</span>
          )}
        </button>

        {/* Chip Grupos */}
        <button
          type="button"
          className={`wa-chip ${filtroChip === 'grupos' ? 'active' : ''}`}
          onClick={() => setFiltroChip('grupos')}
        >
          <span>Grupos</span>
          {canalesGrupales.length > 0 && (
            <span className="wa-chip-badge-neutral">{canalesGrupales.length}</span>
          )}
        </button>

        {/* Botón + */}
        <button
          type="button"
          className="wa-chip-add"
          title="Crear nuevo canal o grupo"
          onClick={onAbrirModalCrearCanal}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 4. Lista Unificada de Chats estilo WhatsApp */}
      <div className="ci-list-sections wa-chat-list">
        {chatsUnificados.length === 0 ? (
          <div className="wa-empty-list-msg">
            No hay chats que coincidan con el filtro.
          </div>
        ) : (
          chatsUnificados.map((item) => {
            if (item.tipoItem === 'canal') {
              const canal = item.canal;
              const isCanalActive = canalActivo?.tipo === 'canal' && Number(canalActivo?.id) === Number(canal.id);
              const canalTyping = escribiendoMap[canal.id] ? Object.values(escribiendoMap[canal.id]) : [];
              const isCanalTyping = canalTyping.length > 0;

              const lastMsg = item.lastMsg;
              const ultimaReac = item.ultimaReac;
              const isReactionLatest = item.isReactionLatest;
              const hasUnread = !isCanalActive && (canal.unread_count || 0) > 0;
              const timeFormatted = formatWhatsAppTime(
                isReactionLatest ? ultimaReac.created_at : (lastMsg?.created_at || canal.created_at)
              );
              const isOwnLastMsg = Number(lastMsg?.emisor_id) === Number(userActual?.id);

              return (
                <div
                  key={item.id}
                  className={`ci-item wa-chat-item ${isCanalActive ? 'active' : ''}`}
                  onClick={() => onSeleccionarCanal(canal)}
                >
                  {/* Avatar del Canal */}
                  <div className="wa-item-avatar-wrap">
                    {canal.foto ? (
                      <img
                        src={resolveAvatar(canal.foto)}
                        alt={canal.nombre}
                        className="wa-item-avatar-img"
                        style={{ width: '49px', height: '49px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className={`wa-item-avatar-channel ${canal.es_privado ? 'privado' : 'publico'}`}>
                        {canal.es_privado ? <Lock size={20} /> : <Hash size={22} />}
                      </div>
                    )}
                  </div>

                  {/* Información y Mensajes */}
                  <div className="wa-item-body">
                    <div className="wa-item-top-row">
                      <div className="wa-item-title" title={canal.nombre}>
                        <span className="wa-item-name-text">
                          {renderContentWithAppleEmojis(canal.nombre, '1.15em')}
                        </span>
                        {canal.canal_eliminado ? (
                          <span className="wa-tag-archived" style={{ flexShrink: 0 }}>[Eliminado]</span>
                        ) : canal.soy_miembro_activo === false ? (
                          <span className="wa-tag-archived" style={{ flexShrink: 0 }}>[Archivado]</span>
                        ) : null}
                      </div>
                      <span className={`wa-item-time ${hasUnread ? 'unread' : ''}`}>
                        {timeFormatted}
                      </span>
                    </div>

                    <div className="wa-item-bottom-row">
                      <div className="wa-item-snippet">
                        {isCanalTyping ? (
                          <span className="wa-snippet-text wa-typing-active-text" style={{ color: '#00a884', fontWeight: 500 }}>
                            {canalTyping.length === 1 ? `${canalTyping[0]} está escribiendo...` : `${canalTyping.length} personas escribiendo...`}
                          </span>
                        ) : (
                          <>
                            {!isReactionLatest && isOwnLastMsg && lastMsg && (
                              <span className="wa-snippet-ticks">
                                {lastMsg.leido ? (
                                  <CheckCheck size={16} color="#53bdeb" />
                                ) : lastMsg.entregado ? (
                                  <CheckCheck size={16} color="#8696a0" />
                                ) : (
                                  <Check size={16} color="#8696a0" />
                                )}
                              </span>
                            )}
                            <span className="wa-snippet-text">
                              {isReactionLatest ? (
                                renderReactionSnippet(ultimaReac, userActual, true)
                              ) : lastMsg ? (
                                <>
                                  {!isOwnLastMsg && (
                                    <span className="wa-snippet-sender">
                                      {`${lastMsg.emisor_nombre?.split(' ')[0] || 'Mensaje'}: `}
                                    </span>
                                  )}
                                  {renderSnippetBody(lastMsg)}
                                </>
                              ) : (
                                renderContentWithAppleEmojis(canal.descripcion || 'Sin mensajes recientes', '1.15em')
                              )}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="wa-item-badges-wrap">
                        {canal.fijado && (
                          <Pin size={13} className="wa-pin-icon" fill="#8696a0" />
                        )}
                        {hasUnread && (
                          <span className="wa-unread-badge">{canal.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Contacto / Chat Directo
            const contacto = item.contacto;
            const directCanal = item.directCanal;
            const isDirectActive = canalActivo?.tipo === 'directo' && (
              Number(canalActivo?.otro_participante?.id) === Number(contacto?.id) ||
              (directCanal && Number(canalActivo?.id) === Number(directCanal.id))
            );
            const directTyping = directCanal?.id && escribiendoMap[directCanal.id]
              ? Object.values(escribiendoMap[directCanal.id])
              : Object.entries(escribiendoMap).some(([_, map]) => map && map[contacto?.id])
                ? [contacto?.nombre]
                : [];
            const isContactTyping = directTyping.length > 0;

            const unread = directCanal?.unread_count || 0;
            const hasUnread = !isDirectActive && unread > 0;
            const isPinned = item.isPinned;

            const lastMsg = item.lastMsg;
            const ultimaReac = item.ultimaReac;
            const isReactionLatest = item.isReactionLatest;

            const timeFormatted = formatWhatsAppTime(
              isReactionLatest ? ultimaReac.created_at : (lastMsg?.created_at || (lastMsg ? new Date().toISOString() : null))
            );
            const isOwnLastMsg = Number(lastMsg?.emisor_id) === Number(userActual?.id);

            return (
              <div
                key={item.id}
                className={`ci-item wa-chat-item ${isDirectActive ? 'active' : ''}`}
                onClick={() => {
                  if (directCanal) {
                    onSeleccionarCanal(directCanal);
                  } else {
                    onAbrirDirecto(contacto.id);
                  }
                }}
              >
                {/* Avatar con dot de presencia */}
                <div className="wa-item-avatar-wrap">
                  {contacto?.foto_perfil ? (
                    <img
                      src={resolveAvatar(contacto.foto_perfil)}
                      alt={contacto.nombre}
                      className="wa-item-avatar-img"
                    />
                  ) : (
                    <div className="wa-item-avatar-placeholder">
                      {contacto?.nombre ? contacto.nombre.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  {(() => {
                    const pres = getPresenciaInfo(contacto);
                    return (
                      <div
                        className={`wa-online-dot ${pres.estaOnline ? pres.id : 'offline'}`}
                        style={{
                          backgroundColor: pres.color,
                          boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 3px rgba(0,0,0,0.3)`
                        }}
                        title={`${contacto?.nombre}: ${pres.labelConEstado}${pres.desc ? ` (${pres.desc})` : ''}`}
                      />
                    );
                  })()}
                </div>

                {/* Contenido del ítem */}
                <div className="wa-item-body">
                  <div className="wa-item-top-row">
                    <div className="wa-item-title" title={contacto?.nombre}>
                      <span className="wa-item-name-text">
                        {renderContentWithAppleEmojis(contacto?.nombre || 'Contacto', '1.15em')}
                      </span>
                      {(() => {
                        const pres = getPresenciaInfo(contacto);
                        if (pres.estaOnline && pres.id !== 'disponible') {
                          return (
                            <span
                              className="wa-presence-badge-tag"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginLeft: '4px',
                                padding: '0 6px',
                                borderRadius: '8px',
                                background: `${pres.color}20`,
                                border: `1px solid ${pres.color}50`,
                                color: pres.color,
                                fontSize: '0.67rem',
                                fontWeight: 600,
                                verticalAlign: 'middle',
                                lineHeight: '16px',
                                flexShrink: 0,
                                whiteSpace: 'nowrap'
                              }}
                              title={`Estado de presencia: ${pres.label} (${pres.desc})`}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pres.color, flexShrink: 0 }} />
                              {pres.label}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <span className={`wa-item-time ${hasUnread ? 'unread' : ''}`}>
                      {timeFormatted}
                    </span>
                  </div>

                  <div className="wa-item-bottom-row">
                    <div className="wa-item-snippet">
                      {isContactTyping ? (
                        <span className="wa-snippet-text wa-typing-active-text" style={{ color: '#00a884', fontWeight: 500 }}>
                          escribiendo...
                        </span>
                      ) : (
                        <>
                          {!isReactionLatest && isOwnLastMsg && lastMsg && (
                            <span className="wa-snippet-ticks">
                              {lastMsg.leido ? (
                                <CheckCheck size={16} color="#53bdeb" />
                              ) : (lastMsg.entregado || contacto?.esta_online) ? (
                                <CheckCheck size={16} color="#8696a0" />
                              ) : (
                                <Check size={16} color="#8696a0" />
                              )}
                            </span>
                          )}
                          <span className="wa-snippet-text">
                            {isReactionLatest ? (
                              renderReactionSnippet(ultimaReac, userActual, false)
                            ) : lastMsg ? (
                              renderSnippetBody(lastMsg)
                            ) : (() => {
                              const pres = getPresenciaInfo(contacto);
                              const baseText = contacto?.area || contacto?.rol || 'Contacto interno';
                              return renderContentWithAppleEmojis(
                                pres.estaOnline ? `${baseText} • ${pres.labelConEstado}` : `${baseText} • Desconectado`,
                                '1.15em'
                              );
                            })()}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="wa-item-badges-wrap">
                      {isPinned && (
                        <Pin size={13} className="wa-pin-icon" fill="#8696a0" />
                      )}
                      {hasUnread && (
                        <span className="wa-unread-badge">{unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default ChatInternoSidebar;
