import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Minus, X, Maximize2, Send, ThumbsUp, Hash, Plus, Search, User, Users,
  Paperclip, Smile, FileText, Download, Check, CheckCheck
} from 'lucide-react';
import { API_URL, resolveAvatar, resolveMedia } from '../../services/api';
import { chatInternoService } from '../../services/chatInterno.service';
import ChatInternoStickerPicker from '../ChatInterno/ChatInternoStickerPicker';
import ChatInternoAudioPlayer from '../ChatInterno/ChatInternoAudioPlayer';
import VoiceRecorder from '../Chat/VoiceRecorder';
import { renderContentWithAppleEmojis } from '../../utils/appleEmojiHelper';
import { getPresenciaInfo } from '../../utils/presenceHelper';

/**
 * Subcomponente: Ventana individual de Messenger Dock flotante
 */
const SingleDockWindow = ({
  chat,
  onClose,
  onMinimize,
  onExpand,
  socket,
  userActual,
  dockIndex = 0,
}) => {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // Cargar mensajes al abrir el dock
  useEffect(() => {
    if (!chat.canalId) return;
    let cancel = false;

    const cargar = async () => {
      try {
        setCargando(true);
        const data = await chatInternoService.getMensajes(chat.canalId, 35);
        if (!cancel) {
          setMensajes(data.mensajes || []);
          // Marcar como leído únicamente porque el usuario tiene abierta la ventana
          chatInternoService.marcarLeido(chat.canalId).catch(() => {});
        }
      } catch (err) {
        console.error('Error al cargar mensajes en dock flotante:', err);
      } finally {
        if (!cancel) setCargando(false);
      }
    };

    cargar();

    if (socket) {
      socket.emit('chat_interno:join_canal', { canalId: chat.canalId, agenteId: userActual?.id });
    }

    return () => {
      cancel = true;
      if (socket) {
        socket.emit('chat_interno:leave_canal', { canalId: chat.canalId });
      }
    };
  }, [chat.canalId, socket, userActual?.id]);

  // Escuchar nuevos mensajes por socket mientras esta ventana esté abierta
  useEffect(() => {
    if (!socket || !chat.canalId) return;

    const handleNuevo = ({ canalId, mensaje }) => {
      if (Number(canalId) === Number(chat.canalId)) {
        setMensajes(prev => {
          if (prev.some(m => Number(m.id) === Number(mensaje.id))) return prev;
          return [...prev, mensaje];
        });

        // Solo marcar como leído si no es propio y la ventana está visible
        if (Number(mensaje.emisor_id) !== Number(userActual?.id)) {
          chatInternoService.marcarLeido(canalId, mensaje.id).catch(() => {});
        }
      }
    };

    const handleLeidos = ({ canalId, agenteId, ultimoMensajeId }) => {
      if (Number(canalId) === Number(chat.canalId) && Number(agenteId) !== Number(userActual?.id)) {
        setMensajes(prev => prev.map(m => {
          if (Number(m.emisor_id) === Number(userActual?.id) && (!ultimoMensajeId || Number(m.id) <= Number(ultimoMensajeId))) {
            return { ...m, leido: true, entregado: true };
          }
          return m;
        }));
      }
    };

    const handleEntregado = ({ canalId, mensajeId, emisorId }) => {
      if (Number(canalId) === Number(chat.canalId) && (!emisorId || Number(emisorId) === Number(userActual?.id))) {
        setMensajes(prev => prev.map(m => {
          if (Number(m.emisor_id) === Number(userActual?.id) && (!mensajeId || Number(m.id) <= Number(mensajeId))) {
            return { ...m, entregado: true };
          }
          return m;
        }));
      }
    };

    socket.on('chat_interno:nuevo_mensaje', handleNuevo);
    socket.on('chat_interno:mensajes_leidos', handleLeidos);
    socket.on('chat_interno:mensaje_entregado', handleEntregado);
    return () => {
      socket.off('chat_interno:nuevo_mensaje', handleNuevo);
      socket.off('chat_interno:mensajes_leidos', handleLeidos);
      socket.off('chat_interno:mensaje_entregado', handleEntregado);
    };
  }, [socket, chat.canalId, userActual?.id]);

  // Auto-scroll al fondo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleSend = async (textoAEnviar = texto) => {
    if (enviando || !textoAEnviar.trim() || !chat.canalId) return;
    try {
      setEnviando(true);
      const nuevo = await chatInternoService.enviarMensajeTexto(chat.canalId, textoAEnviar.trim());
      setMensajes(prev => {
        if (prev.some(m => Number(m.id) === Number(nuevo.id))) return prev;
        return [...prev, nuevo];
      });
      setTexto('');
    } catch (err) {
      console.error('Error al enviar mensaje en dock flotante:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviarAudio = async (blob, duracionStr) => {
    if (enviando || !chat.canalId) return;
    try {
      setEnviando(true);
      const file = new File([blob], `audio_${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
      const nuevo = await chatInternoService.enviarMensajeAdjunto(chat.canalId, file, duracionStr || '0:07', 'audio');
      setMensajes(prev => {
        if (prev.some(m => Number(m.id) === Number(nuevo.id))) return prev;
        return [...prev, nuevo];
      });
    } catch (err) {
      console.error('Error al enviar nota de voz en dock flotante:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviarSticker = async (stickerUrl) => {
    if (enviando || !chat.canalId) return;
    try {
      setEnviando(true);
      setShowPicker(false);
      const nuevo = await chatInternoService.enviarSticker(chat.canalId, stickerUrl);
      setMensajes(prev => {
        if (prev.some(m => Number(m.id) === Number(nuevo.id))) return prev;
        return [...prev, nuevo];
      });
    } catch (err) {
      console.error('Error al enviar sticker en dock flotante:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chat.canalId || enviando) return;
    try {
      setEnviando(true);
      const tipo = file.type.startsWith('image/') ? 'imagen' : 'archivo';
      const nuevo = await chatInternoService.enviarMensajeAdjunto(chat.canalId, file, '', tipo);
      setMensajes(prev => {
        if (prev.some(m => Number(m.id) === Number(nuevo.id))) return prev;
        return [...prev, nuevo];
      });
    } catch (err) {
      console.error('Error al enviar archivo en dock flotante:', err);
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectEmoji = (emojiChar) => {
    const char = typeof emojiChar === 'string' ? emojiChar : emojiChar?.native || '';
    if (!char) return;
    setTexto(prev => prev + char);
    inputRef.current?.focus();
  };

  const otro = chat.otroUsuario;
  const rightOffset = 88 + dockIndex * 344;

  return (
    <div className="fb-messenger-dock" style={{ right: `${rightOffset}px` }}>
      {/* Cabecera estilo Messenger */}
      <div className="fb-messenger-header">
        <div className="fb-messenger-header-info" onClick={() => onMinimize && onMinimize(chat.canalId)}>
          <div className="fb-messenger-avatar-wrap">
            {chat.tipo === 'canal' ? (
              chat.canalFoto ? (
                <img src={resolveAvatar(chat.canalFoto)} alt={chat.canalNombre} />
              ) : (
                <div className="fb-messenger-avatar-placeholder">
                  <Hash size={14} />
                </div>
              )
            ) : otro?.foto_perfil ? (
              <img src={resolveAvatar(otro.foto_perfil)} alt={chat.canalNombre} />
            ) : (
              <div className="fb-messenger-avatar-placeholder">
                {chat.canalNombre?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            {chat.tipo !== 'canal' && (() => {
              const pres = getPresenciaInfo(otro);
              return (
                <div
                  className="fb-messenger-online-dot"
                  style={{
                    backgroundColor: pres.color,
                    boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 2px rgba(0,0,0,0.3)`
                  }}
                  title={pres.labelConEstado}
                />
              );
            })()}
          </div>

          <div className="fb-messenger-titles">
            <span className="fb-messenger-name">{chat.canalNombre || 'Chat'}</span>
            <span className="fb-messenger-status">
              {chat.tipo === 'canal' ? 'Canal grupal' : (() => {
                const pres = getPresenciaInfo(otro);
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pres.color }} />
                    {pres.labelConEstado}
                    {otro?.area ? ` • ${otro.area}` : ''}
                  </span>
                );
              })()}
            </span>
          </div>
        </div>

        <div className="fb-messenger-header-actions">
          {onExpand && (
            <button
              type="button"
              className="fb-messenger-btn"
              onClick={() => onExpand(chat.canalId)}
              title="Abrir en Chat Interno"
            >
              <Maximize2 size={13} />
            </button>
          )}
          {onMinimize && (
            <button
              type="button"
              className="fb-messenger-btn"
              onClick={() => onMinimize(chat.canalId)}
              title="Minimizar a burbuja"
            >
              <Minus size={14} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="fb-messenger-btn"
              onClick={() => onClose(chat.canalId)}
              title="Cerrar chat"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Popover de Emojis y Stickers */}
      {showPicker && (
        <div className="fb-dock-picker-popover">
          <ChatInternoStickerPicker
            agenteId={userActual?.id}
            onSelectEmoji={handleSelectEmoji}
            onSelectSticker={handleEnviarSticker}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}

      {/* Cuerpo de Mensajes */}
      <div className="fb-messenger-body">
        {cargando ? (
          <div className="fb-messenger-loading">Cargando mensajes...</div>
        ) : mensajes.length === 0 ? (
          <div className="fb-messenger-empty">
            <p>Saluda a tu compañero 👋</p>
          </div>
        ) : (
          mensajes.map((m) => {
            const isOwn = Number(m.emisor_id) === Number(userActual?.id);
            const isAudio = m.tipo === 'audio' || m.tipo === 'voice';
            const isSticker = m.tipo === 'sticker';
            const isImg = m.tipo === 'imagen';
            const isFile = m.tipo === 'archivo';
            const timeStr = m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            const renderStatusTicks = (msg) => {
              const isLeido = Boolean(msg.leido);
              const isEntregado = isLeido || Boolean(msg.entregado);
              if (isLeido) {
                return (
                  <span className="fb-msg-status-ticks" title="Leído">
                    <CheckCheck size={13} color="#53bdeb" style={{ marginLeft: 3, verticalAlign: 'middle' }} />
                  </span>
                );
              }
              if (isEntregado) {
                return (
                  <span className="fb-msg-status-ticks" title="Entregado">
                    <CheckCheck size={13} color="#8696a0" style={{ marginLeft: 3, verticalAlign: 'middle' }} />
                  </span>
                );
              }
              return (
                <span className="fb-msg-status-ticks" title="Enviado">
                  <Check size={13} color="#8696a0" style={{ marginLeft: 3, verticalAlign: 'middle' }} />
                </span>
              );
            };

            return (
              <div key={m.id} className={`fb-msg-row ${isOwn ? 'own' : ''}`}>
                {!isOwn && (
                  <div className="fb-msg-avatar" title={m.emisor_nombre}>
                    {m.emisor_foto ? (
                      <img src={resolveAvatar(m.emisor_foto)} alt={m.emisor_nombre} />
                    ) : (
                      <div className="fb-msg-avatar-placeholder">
                        {m.emisor_nombre ? m.emisor_nombre.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                )}

                <div className={`fb-msg-bubble ${isSticker ? 'is-sticker' : ''} ${isAudio ? 'is-audio' : ''}`}>
                  {/* Nombre en grupales */}
                  {!isOwn && chat.tipo === 'canal' && m.emisor_nombre && !isSticker && (
                    <span className="fb-msg-sender-name">{m.emisor_nombre}</span>
                  )}

                  {/* Texto */}
                  {m.mensaje && (
                    <div className="fb-msg-text">
                      {renderContentWithAppleEmojis(m.mensaje)}
                    </div>
                  )}

                  {/* Audio / Nota de voz */}
                  {isAudio && m.url_adjunto && (
                    <div className="fb-msg-audio-wrap">
                      <ChatInternoAudioPlayer
                        src={m.url_adjunto.startsWith('http') ? m.url_adjunto : `${API_URL}${m.url_adjunto}`}
                        msgId={m.id}
                        isOwn={isOwn}
                        formatTime={timeStr}
                        ticks={isOwn ? renderStatusTicks(m) : null}
                        senderFoto={m.emisor_foto ? resolveAvatar(m.emisor_foto) : (isOwn && userActual?.foto_perfil ? resolveAvatar(userActual.foto_perfil) : null)}
                        senderNombre={m.emisor_nombre || (isOwn ? userActual?.nombre : '')}
                      />
                    </div>
                  )}

                  {/* Sticker */}
                  {isSticker && m.url_adjunto && (
                    <img
                      src={resolveMedia(m.url_adjunto)}
                      alt="Sticker"
                      className="fb-msg-sticker-img"
                      loading="lazy"
                    />
                  )}

                  {/* Imagen */}
                  {isImg && m.url_adjunto && (
                    <img
                      src={`${API_URL}${m.url_adjunto}`}
                      alt="Adjunto"
                      className="fb-msg-img"
                      onClick={() => window.open(`${API_URL}${m.url_adjunto}`, '_blank')}
                    />
                  )}

                  {/* Archivo */}
                  {isFile && m.url_adjunto && (
                    <a
                      href={`${API_URL}${m.url_adjunto}`}
                      target="_blank"
                      rel="noreferrer"
                      className="fb-msg-file-card"
                      download
                    >
                      <FileText size={18} className="fb-file-icon" />
                      <div className="fb-file-info">
                        <span className="fb-file-name">{m.nombre_adjunto || 'Archivo'}</span>
                        {m.tamano_adjunto && (
                          <span className="fb-file-size">{(m.tamano_adjunto / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                      <Download size={14} className="fb-file-download-icon" />
                    </a>
                  )}

                  {/* Hora sutil y checks */}
                  {!isSticker && !isAudio && timeStr && (
                    <span className="fb-msg-time">
                      {timeStr}
                      {isOwn && renderStatusTicks(m)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada Messenger */}
      <div className="fb-messenger-footer">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="fb-messenger-tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Adjuntar archivo o imagen"
          disabled={enviando}
        >
          <Paperclip size={18} />
        </button>

        <button
          type="button"
          className={`fb-messenger-tool-btn ${showPicker ? 'active' : ''}`}
          onClick={() => setShowPicker(prev => !prev)}
          title="Emojis y Stickers"
          disabled={enviando}
        >
          <Smile size={18} />
        </button>

        <input
          ref={inputRef}
          type="text"
          className="fb-messenger-input"
          placeholder="Escribe un mensaje..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {texto.trim() ? (
          <button
            type="button"
            className="fb-messenger-send-btn active"
            onClick={() => handleSend()}
            disabled={enviando}
            title="Enviar"
          >
            <Send size={15} />
          </button>
        ) : (
          <>
            <VoiceRecorder onSend={handleEnviarAudio} disabled={enviando} />
            <button
              type="button"
              className="fb-messenger-like-btn"
              onClick={() => handleSend('👍')}
              disabled={enviando}
              title="Enviar pulgar arriba"
            >
              <ThumbsUp size={16} color="#0084ff" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Subcomponente: Popover para iniciar un nuevo chat rápido desde cualquier módulo
 */
const NuevoChatPopover = ({ onClose, onSelectContacto, onSelectCanal, positionBottom = false }) => {
  const [busqueda, setBusqueda] = useState('');
  const [contactos, setContactos] = useState([]);
  const [canales, setCanales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('todos'); // 'todos' | 'contactos' | 'canales'

  useEffect(() => {
    let cancel = false;
    const cargarDatos = async () => {
      try {
        setCargando(true);
        const [contactosData, canalesData] = await Promise.all([
          chatInternoService.getContactos().catch(() => []),
          chatInternoService.getCanales().catch(() => [])
        ]);
        if (!cancel) {
          setContactos(contactosData || []);
          setCanales(canalesData || []);
        }
      } finally {
        if (!cancel) setCargando(false);
      }
    };
    cargarDatos();
    return () => { cancel = true; };
  }, []);

  const query = busqueda.toLowerCase().trim();

  const contactosFiltrados = useMemo(() => {
    return contactos.filter(c => {
      const nombre = (c.nombre || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const area = (c.area || '').toLowerCase();
      return nombre.includes(query) || email.includes(query) || area.includes(query);
    });
  }, [contactos, query]);

  const canalesFiltrados = useMemo(() => {
    return canales.filter(c => {
      if (c.tipo === 'directo') return false;
      const nombre = (c.nombre || '').toLowerCase();
      return nombre.includes(query);
    });
  }, [canales, query]);

  return (
    <div className={`fb-new-chat-popover ${positionBottom ? 'from-bottom' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="fb-new-chat-header">
        <span className="fb-new-chat-title">Nuevo Mensaje</span>
        <button type="button" className="fb-new-chat-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="fb-new-chat-search-wrap">
        <Search size={14} className="fb-new-chat-search-icon" />
        <input
          type="text"
          className="fb-new-chat-input"
          placeholder="Buscar compañero o canal..."
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="fb-new-chat-tabs">
        <button
          type="button"
          className={`fb-new-chat-tab ${tab === 'todos' ? 'active' : ''}`}
          onClick={() => setTab('todos')}
        >
          Todos
        </button>
        <button
          type="button"
          className={`fb-new-chat-tab ${tab === 'contactos' ? 'active' : ''}`}
          onClick={() => setTab('contactos')}
        >
          Compañeros
        </button>
        <button
          type="button"
          className={`fb-new-chat-tab ${tab === 'canales' ? 'active' : ''}`}
          onClick={() => setTab('canales')}
        >
          Canales
        </button>
      </div>

      <div className="fb-new-chat-list">
        {cargando ? (
          <div className="fb-new-chat-loading">Cargando compañeros...</div>
        ) : (
          <>
            {/* Canales Grupales */}
            {(tab === 'todos' || tab === 'canales') && canalesFiltrados.length > 0 && (
              <div className="fb-new-chat-section">
                <div className="fb-new-chat-section-label">Canales</div>
                {canalesFiltrados.map(canal => (
                  <div
                    key={`c_${canal.id}`}
                    className="fb-new-chat-item"
                    onClick={() => onSelectCanal(canal)}
                  >
                    <div className="fb-new-chat-item-avatar channel">
                      {canal.foto ? (
                        <img src={resolveAvatar(canal.foto)} alt={canal.nombre} />
                      ) : (
                        <Hash size={16} />
                      )}
                    </div>
                    <div className="fb-new-chat-item-info">
                      <span className="fb-new-chat-item-name">#{canal.nombre.replace(/^#+/, '')}</span>
                      <span className="fb-new-chat-item-sub">Canal del equipo</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Compañeros Directos */}
            {(tab === 'todos' || tab === 'contactos') && (
              <div className="fb-new-chat-section">
                <div className="fb-new-chat-section-label">Compañeros de equipo</div>
                {contactosFiltrados.length === 0 ? (
                  <div className="fb-new-chat-empty">No se encontraron resultados</div>
                ) : (
                  contactosFiltrados.map(contacto => (
                    <div
                      key={`u_${contacto.id}`}
                      className="fb-new-chat-item"
                      onClick={() => onSelectContacto(contacto)}
                    >
                      {(() => {
                        const pres = getPresenciaInfo(contacto);
                        return (
                          <>
                            <div className="fb-new-chat-item-avatar">
                              {contacto.foto_perfil ? (
                                <img src={resolveAvatar(contacto.foto_perfil)} alt={contacto.nombre} />
                              ) : (
                                <div className="fb-new-chat-item-placeholder">
                                  {contacto.nombre ? contacto.nombre.charAt(0).toUpperCase() : <User size={14} />}
                                </div>
                              )}
                              <div
                                className="fb-new-chat-item-online"
                                style={{
                                  backgroundColor: pres.color,
                                  boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 2px rgba(0,0,0,0.3)`
                                }}
                                title={pres.labelConEstado}
                              />
                            </div>
                            <div className="fb-new-chat-item-info">
                              <span className="fb-new-chat-item-name">
                                {contacto.nombre}
                                {pres.estaOnline && pres.id !== 'disponible' && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      padding: '0 5px',
                                      borderRadius: 6,
                                      background: `${pres.color}20`,
                                      border: `1px solid ${pres.color}45`,
                                      color: pres.color,
                                      fontSize: '0.66rem',
                                      fontWeight: 600
                                    }}
                                  >
                                    {pres.label}
                                  </span>
                                )}
                              </span>
                              <span className="fb-new-chat-item-sub">
                                {contacto.area || contacto.rol || 'Miembro'}
                                {pres.estaOnline ? ` · ${pres.labelConEstado}` : ' · Desconectado'}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Componente Principal: Contenedor Multi-Burbujas Flotantes (Facebook Messenger style)
 */
const FloatingMessengerDock = ({
  floatingChats = [],
  onAbrirChat,
  onMinimizeChat,
  onCloseChat,
  onExpandChat,
  // Props de compatibilidad
  miniChat,
  onClose,
  onMinimize,
  onExpand,
  socket,
  userActual,
}) => {
  const [showNewChat, setShowNewChat] = useState(false);

  // Normalizar lista de chats: si no viene floatingChats, usar miniChat como fallback
  const chatsList = useMemo(() => {
    if (Array.isArray(floatingChats) && floatingChats.length > 0) {
      return floatingChats.filter(c => c && c.canalId);
    }
    if (miniChat && miniChat.isOpen && miniChat.canalId) {
      return [{
        canalId: miniChat.canalId,
        canalNombre: miniChat.canalNombre,
        otroUsuario: miniChat.otroUsuario,
        tipo: miniChat.tipo,
        unreadCount: miniChat.unreadCount || 0,
        isOpen: miniChat.isOpen,
        isMinimized: miniChat.isMinimized,
      }];
    }
    return [];
  }, [floatingChats, miniChat]);

  // Manejadores delegados
  const handleAbrir = (canalId, canalNombre, otroUsuario, tipo, canalFoto = null) => {
    if (onAbrirChat) {
      onAbrirChat(canalId, canalNombre, otroUsuario, tipo, canalFoto);
    }
  };

  const handleMinimizar = (canalId) => {
    if (onMinimizeChat) {
      onMinimizeChat(canalId);
    } else if (onMinimize) {
      onMinimize();
    }
  };

  const handleCerrar = (canalId) => {
    if (onCloseChat) {
      onCloseChat(canalId);
    } else if (onClose) {
      onClose();
    }
  };

  const handleExpandir = (canalId) => {
    if (onExpandChat) {
      onExpandChat(canalId);
    } else if (onExpand) {
      onExpand();
    }
  };

  // Chats que tienen su ventana abierta (des-minimizada)
  const openDocks = useMemo(() => {
    return chatsList.filter(c => c.isOpen && !c.isMinimized);
  }, [chatsList]);

  // Manejo de nuevo chat desde el popover
  const handleSelectContacto = async (contacto) => {
    try {
      setShowNewChat(false);
      const res = await chatInternoService.abrirChatDirecto(contacto.id);
      const canalId = res?.id || res?.canal?.id;
      if (canalId) {
        handleAbrir(canalId, contacto.nombre, contacto, 'directo', null);
      }
    } catch (err) {
      console.error('Error al abrir chat directo flotante:', err);
    }
  };

  const handleSelectCanal = (canal) => {
    setShowNewChat(false);
    handleAbrir(canal.id, canal.nombre, null, 'canal', canal.foto);
  };

  return (
    <>
      {/* 1. Ventana(s) Dock abierta(s) */}
      {openDocks.map((chat, idx) => (
        <SingleDockWindow
          key={`dock_${chat.canalId}`}
          chat={chat}
          onClose={handleCerrar}
          onMinimize={handleMinimizar}
          onExpand={handleExpandir}
          socket={socket}
          userActual={userActual}
          dockIndex={idx}
        />
      ))}

      {/* 2. Barra Lateral / Rail Dedicado de Burbujas Flotantes (si hay chats activos) */}
      {chatsList.length > 0 ? (
        <div className="fb-floating-dock-rail">
          {/* Selector de Nuevo Chat (Popover) */}
          {showNewChat && (
            <>
              <div
                className="fb-new-chat-backdrop"
                onClick={() => setShowNewChat(false)}
              />
              <NuevoChatPopover
                onClose={() => setShowNewChat(false)}
                onSelectContacto={handleSelectContacto}
                onSelectCanal={handleSelectCanal}
              />
            </>
          )}

          {/* Botón "+" para nuevo chat en la parte superior del rail */}
          <button
            type="button"
            className={`fb-rail-add-btn ${showNewChat ? 'active' : ''}`}
            onClick={() => setShowNewChat(prev => !prev)}
            title="Iniciar nueva conversación interna"
          >
            <Plus size={20} />
          </button>

          <div className="fb-rail-divider" />

          {/* Lista de burbujas ordenada y espaciada */}
          <div className="fb-rail-bubbles-list">
            {chatsList.map((chat) => {
              const unread = Number(chat.unreadCount || 0);
              const isMin = Boolean(chat.isMinimized);
              const otro = chat.otroUsuario;

              return (
                <div
                  key={`head_${chat.canalId}`}
                  className={`fb-chat-head-bubble ${!isMin ? 'is-dock-open' : ''}`}
                  onClick={() => {
                    if (isMin) {
                      handleAbrir(chat.canalId, chat.canalNombre, chat.otroUsuario, chat.tipo, chat.canalFoto);
                    } else {
                      handleMinimizar(chat.canalId);
                    }
                  }}
                  title={chat.canalNombre || 'Conversación'}
                >
                  <div className="fb-chat-head-avatar-wrap">
                    {chat.tipo === 'canal' ? (
                      chat.canalFoto ? (
                        <img src={resolveAvatar(chat.canalFoto)} alt={chat.canalNombre} />
                      ) : (
                        <div className="fb-chat-head-placeholder fb-chat-head-channel">
                          <Hash size={20} />
                        </div>
                      )
                    ) : otro?.foto_perfil ? (
                      <img src={resolveAvatar(otro.foto_perfil)} alt={chat.canalNombre} />
                    ) : (
                      <div className="fb-chat-head-placeholder">
                        {chat.canalNombre ? chat.canalNombre.charAt(0).toUpperCase() : <Users size={16} />}
                      </div>
                    )}
                    {chat.tipo !== 'canal' && (() => {
                      const pres = getPresenciaInfo(otro);
                      return (
                        <div
                          className="fb-chat-head-online-dot"
                          style={{
                            backgroundColor: pres.color,
                            boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 2px rgba(0,0,0,0.3)`
                          }}
                          title={`${chat.canalNombre}: ${pres.labelConEstado}`}
                        />
                      );
                    })()}

                    {/* GLOBO CONTADOR DE MENSAJES PENDIENTES */}
                    {unread > 0 && isMin && (
                      <span className="fb-chat-head-badge">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>

                  {/* Botón cerrar burbuja individual */}
                  <button
                    type="button"
                    className="fb-chat-head-close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCerrar(chat.canalId);
                    }}
                    title="Cerrar burbuja"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Launcher flotante compacto cuando no hay burbujas (situado sobre la barra para no tapar enviar) */
        <div className="fb-floating-empty-launcher">
          {showNewChat && (
            <>
              <div
                className="fb-new-chat-backdrop"
                onClick={() => setShowNewChat(false)}
              />
              <NuevoChatPopover
                onClose={() => setShowNewChat(false)}
                onSelectContacto={handleSelectContacto}
                onSelectCanal={handleSelectCanal}
                positionBottom
              />
            </>
          )}
          <button
            type="button"
            className={`fb-chat-head-bubble fb-chat-head-add-btn ${showNewChat ? 'active' : ''}`}
            onClick={() => setShowNewChat(prev => !prev)}
            title="Iniciar nueva conversación interna"
          >
            <Plus size={22} />
          </button>
        </div>
      )}
    </>
  );
};

export default FloatingMessengerDock;

