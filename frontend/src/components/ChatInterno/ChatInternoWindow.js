import React, { useState, useRef, useEffect } from 'react';
import {
  Hash, Lock, Send, Paperclip, File, Download,
  X, MessageSquare, Info, Shield, ShieldAlert, User
} from 'lucide-react';
import { API_URL, resolveAvatar } from '../../services/api';

const EMOJIS_DISPONIBLES = ['👍', '❤️', '👏', '🔥', '✅', '🎉'];

const ChatInternoWindow = ({
  canalActivo,
  mensajes,
  cargandoMensajes,
  escribiendoMap,
  onEnviarTexto,
  onEnviarAdjunto,
  onTyping,
  onToggleReaccion,
  onToggleDetalles,
  detallesOpen,
  userActual,
}) => {
  const [texto, setTexto] = useState('');
  const [adjunto, setAdjunto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, escribiendoMap]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e) => {
    setTexto(e.target.value);
    onTyping();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAdjunto(file);
    }
  };

  const handleSend = async () => {
    if (enviando) return;
    if (!texto.trim() && !adjunto) return;

    try {
      setEnviando(true);
      if (adjunto) {
        await onEnviarAdjunto(adjunto, texto.trim());
        setAdjunto(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await onEnviarTexto(texto.trim());
      }
      setTexto('');
    } catch (err) {
      alert(err.message || 'Error al enviar mensaje');
    } finally {
      setEnviando(false);
    }
  };

  if (!canalActivo) {
    return (
      <main className="ci-window">
        <div className="ci-empty-chat">
          <MessageSquare size={48} strokeWidth={1.5} color="#94a3b8" />
          <h3 style={{ margin: 0 }}>Chat Corporativo</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Selecciona un canal o compañero del panel lateral para comenzar a chatear.
          </p>
        </div>
      </main>
    );
  }

  const esDirecto = canalActivo.tipo === 'directo';
  const otro = canalActivo.otro_participante;
  const headerTitulo = esDirecto ? (otro?.nombre || 'Chat Directo') : `#${canalActivo.nombre}`;

  const getPresenciaTexto = (part) => {
    if (!part?.esta_online) return 'Desconectado';
    const st = part.estado_presencia || 'disponible';
    switch (st) {
      case 'reunion': return 'En reunión';
      case 'ocupado': return 'No molestar';
      case 'comida':  return 'En comida';
      case 'ausente': return 'Ausente';
      default:        return 'En línea';
    }
  };

  const headerSub = esDirecto
    ? `${getPresenciaTexto(otro)} • ${otro?.area || otro?.rol || ''}`
    : (canalActivo.descripcion || (canalActivo.es_privado ? 'Canal privado' : 'Canal público'));

  const esAdmin = userActual?.rol === 'admin';
  const esCreador = Number(canalActivo.creador_id) === Number(userActual?.id);
  const puedePublicar = !canalActivo.solo_lectura || esAdmin || esCreador;

  const nombresEscribiendo = Object.values(escribiendoMap);

  return (
    <main className="ci-window">
      {/* Cabecera */}
      <header className="ci-window-header">
        <div className="ci-header-left">
          {esDirecto ? (
            <div className="ci-item-avatar-wrap">
              {otro?.foto_perfil ? (
                <img src={resolveAvatar(otro.foto_perfil)} alt={otro.nombre} className="ci-avatar-img" />
              ) : (
                <div className="ci-avatar-placeholder">
                  {otro?.nombre ? otro.nombre.charAt(0).toUpperCase() : <User size={16} />}
                </div>
              )}
              <div className={`ci-online-dot ${otro?.esta_online ? '' : 'offline'}`} />
            </div>
          ) : (
            <div className="ci-avatar-placeholder" style={{ background: canalActivo.es_privado ? '#475569' : '#2563eb' }}>
              {canalActivo.es_privado ? <Lock size={16} /> : <Hash size={18} />}
            </div>
          )}

          <div>
            <div className="ci-header-title">
              <span>{headerTitulo}</span>
              {(canalActivo.canal_eliminado || canalActivo.soy_miembro_activo === false) && (
                <span className="ci-pill-removed" title="Has sido removido de este canal">
                  <ShieldAlert size={12} /> Acceso de Historial
                </span>
              )}
              {canalActivo.solo_lectura && (
                <span className="ci-pill-readonly" title="Solo creador y administradores pueden publicar">
                  <Shield size={12} /> Solo Lectura
                </span>
              )}
            </div>
            <div className="ci-header-desc">{headerSub}</div>
          </div>
        </div>

        <div className="ci-header-actions">
          <button
            className={`ci-btn-icon ${detallesOpen ? 'active' : ''}`}
            title="Detalles y archivos compartidos"
            onClick={onToggleDetalles}
          >
            <Info size={19} />
          </button>
        </div>
      </header>

      {/* Área de Mensajes */}
      <div className="ci-messages-area">
        {cargandoMensajes ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            Cargando mensajes...
          </div>
        ) : mensajes.length === 0 ? (
          <div className="ci-empty-chat">
            <p>Aún no hay mensajes en este canal. ¡Sé el primero en escribir!</p>
          </div>
        ) : (
          mensajes.map((msg) => {
            const isOwn = Number(msg.emisor_id) === Number(userActual?.id);
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const reacciones = Array.isArray(msg.reacciones) ? msg.reacciones : [];

            return (
              <div
                key={`msg-${msg.id}`}
                className={`ci-msg ${isOwn ? 'own' : ''}`}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                {!isOwn && (
                  <div className="ci-msg-avatar">
                    {msg.emisor_foto ? (
                      <img src={resolveAvatar(msg.emisor_foto)} alt={msg.emisor_nombre} />
                    ) : (
                      <div className="ci-avatar-placeholder">
                        {msg.emisor_nombre ? msg.emisor_nombre.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                )}

                <div className="ci-msg-content">
                  <div className="ci-msg-meta">
                    {!isOwn && <span className="ci-msg-sender">{msg.emisor_nombre}</span>}
                    {!isOwn && msg.emisor_area && (
                      <span className="ci-role-pill">{msg.emisor_area}</span>
                    )}
                    <span>{timeStr}</span>
                  </div>

                  <div className="ci-msg-bubble-wrap">
                    <div className="ci-msg-bubble">
                      {msg.mensaje && <div>{msg.mensaje}</div>}

                      {msg.tipo === 'imagen' && msg.url_adjunto && (
                        <img
                          src={`${API_URL}${msg.url_adjunto}`}
                          alt="Adjunto"
                          className="ci-msg-img"
                          onClick={() => window.open(`${API_URL}${msg.url_adjunto}`, '_blank')}
                        />
                      )}

                      {msg.tipo === 'archivo' && msg.url_adjunto && (
                        <a
                          href={`${API_URL}${msg.url_adjunto}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ci-msg-file-card"
                          download
                        >
                          <File size={20} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.nombre_adjunto || 'Archivo'}
                            </div>
                            {msg.tamano_adjunto && (
                              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                {(msg.tamano_adjunto / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </div>
                          <Download size={16} />
                        </a>
                      )}
                    </div>

                    {/* Barra flotante de reacciones rápidas en hover */}
                    {hoveredMsgId === msg.id && (
                      <div className="ci-msg-reactions-hover-bar">
                        {EMOJIS_DISPONIBLES.map(emoji => (
                          <button
                            key={emoji}
                            className="ci-reaction-btn-quick"
                            onClick={() => onToggleReaccion(msg.id, emoji)}
                            title={`Reaccionar con ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chips de reacciones debajo del mensaje */}
                  {reacciones.length > 0 && (
                    <div className="ci-reactions-chips-list">
                      {reacciones.map(r => (
                        <div key={r.emoji} className="ci-reaction-chip-wrapper">
                          <button
                            className={`ci-reaction-chip ${r.reacted_by_me ? 'active' : ''}`}
                            onClick={() => onToggleReaccion(msg.id, r.emoji)}
                          >
                            <span>{r.emoji}</span>
                            <span className="ci-reaction-count">{r.count}</span>
                          </button>
                          <div className="ci-reaction-tooltip">
                            <span className="ci-tooltip-emoji">{r.emoji}</span>
                            <span className="ci-tooltip-names">
                              {(() => {
                                const list = (r.agentes || []).map(a => a === userActual?.nombre ? 'Tú' : a);
                                if (list.length === 0) return 'Sin reacciones';
                                if (list.length === 1) return list[0];
                                if (list.length === 2) return `${list[0]} y ${list[1]}`;
                                if (list.length === 3) return `${list[0]}, ${list[1]} y ${list[2]}`;
                                return `${list.slice(0, 3).join(', ')} y ${list.length - 3} más`;
                              })()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Indicador de escribiendo */}
      <div className="ci-typing-indicator">
        {nombresEscribiendo.length > 0 && (
          <span>
            {nombresEscribiendo.join(', ')} {nombresEscribiendo.length === 1 ? 'está' : 'están'} escribiendo...
          </span>
        )}
      </div>

      {/* Barra de Entrada de Texto o Banner de Estado */}
      {canalActivo.canal_eliminado ? (
        <div className="ci-removed-banner">
          <ShieldAlert size={20} color="#e11d48" style={{ flexShrink: 0 }} />
          <div>
            <strong>Canal Cerrado / Eliminado</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
              Este canal fue cerrado y eliminado por un administrador. Todos los participantes conservan el historial anterior para consulta.
            </div>
          </div>
        </div>
      ) : canalActivo.soy_miembro_activo === false ? (
        <div className="ci-removed-banner">
          <ShieldAlert size={20} color="#e11d48" style={{ flexShrink: 0 }} />
          <div>
            <strong>Has sido removido de este canal</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
              Puedes consultar los mensajes anteriores a tu salida, pero ya no puedes publicar ni recibir nuevos mensajes.
            </div>
          </div>
        </div>
      ) : puedePublicar ? (
        <div className="ci-input-bar">
          {adjunto && (
            <div className="ci-preview-attachment">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={16} />
                <strong>{adjunto.name}</strong>
                <span style={{ opacity: 0.7 }}>({(adjunto.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                className="ci-btn-icon"
                onClick={() => {
                  setAdjunto(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="ci-input-box">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="ci-btn-icon"
              title="Adjuntar archivo o imagen"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} />
            </button>

            <textarea
              className="ci-textarea"
              rows={1}
              placeholder={`Escribe un mensaje en ${headerTitulo}... (Enter para enviar)`}
              value={texto}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
            />

            <button
              type="button"
              className="ci-send-btn"
              disabled={enviando || (!texto.trim() && !adjunto)}
              onClick={handleSend}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="ci-readonly-banner">
          <Lock size={16} color="#64748b" />
          <span>Este canal es de solo lectura. Solo los administradores pueden publicar comunicados.</span>
        </div>
      )}
    </main>
  );
};

export default ChatInternoWindow;
