import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Zap, Trash2, Send, MessageCircle, Activity, ArrowLeft, Smile, Check, CheckCheck } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { apiService, resolveMedia } from '../../services/api';
import { formatMsgTime, formatDaySeparator, isSameDay } from '../../utils/formatDate';
import MediaUpload from './MediaUpload';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import QuickReplyPicker from './QuickReplyPicker';
import QuickRepliesModal from './QuickRepliesModal';
import '../../styles/media-upload.css';
import '../../styles/quick-replies.css';

/** Convierte URLs en el texto en elementos <a> clicables */
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;
function renderTexto(texto) {
  if (!texto) return null;
  const partes = texto.split(URL_REGEX);
  return partes.map((parte, i) =>
    URL_REGEX.test(parte)
      ? <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="msg-link">{parte}</a>
      : parte
  );
}

/** Muestra el tick de estado de un mensaje enviado por el agente */
const MessageTick = ({ estado }) => {
  const isLeido = estado === 'leido';
  const cls = `msg-tick${isLeido ? ' leido' : ''}`;
  if (!estado || estado === 'enviado') return <Check size={14} className={cls} />;
  return <CheckCheck size={14} className={cls} />;
};

const ChatWindow = ({
  conversacionActiva,
  mensajes,
  texto,
  setTexto,
  enviarMensaje,
  enviarMedia,
  cerrarConversacion,
  eliminarConversacion,
  setConversacionActiva,
  clienteEscribiendo,
  user,
}) => {
  const [showEmojiPicker,   setShowEmojiPicker]   = useState(false);
  const [enviandoMedia,     setEnviandoMedia]     = useState(false);
  const [respuestasRapidas, setRespuestasRapidas] = useState([]);
  const [showQRModal,       setShowQRModal]       = useState(false);
  const pickerRef      = useRef(null);
  const inputRef       = useRef(null);
  const lastTypingRef  = useRef(0);
  const containerRef      = useRef(null);
  const cargaInicialRef   = useRef(false);

  // Picker de "/" — activo cuando el texto empieza con "/"
  const slashQuery = texto.startsWith('/') ? texto.slice(1) : null;
  const showQRPicker = slashQuery !== null;

  // Cargar respuestas rápidas del agente una sola vez
  const cargarRR = useCallback(() => {
    apiService.getRespuestasRapidas()
      .then(data => setRespuestasRapidas(data))
      .catch(() => {});
  }, []);

  useEffect(() => { cargarRR(); }, [cargarRR]);

  // Marca que el próximo lote de mensajes es una carga inicial (conversación recién abierta)
  useEffect(() => {
    if (!conversacionActiva) return;
    cargaInicialRef.current = true;
  }, [conversacionActiva?.id]);

  // Scroll al actualizarse los mensajes
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mensajes.length) return;

    if (cargaInicialRef.current) {
      el.scrollTop = el.scrollHeight;
      cargaInicialRef.current = false;
    } else {
      const distanciaFondo = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanciaFondo < 200) el.scrollTop = el.scrollHeight;
    }
  }, [mensajes.length]);

  // Cerrar emoji picker al hacer clic fuera
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const handleSelectRR = (item) => {
    setTexto(item.contenido);
    inputRef.current?.focus();
  };

  const handleEnviarFoto = async (blob, caption) => {
    if (!conversacionActiva || enviandoMedia) return;
    setEnviandoMedia(true);
    try { await enviarMedia('photo', blob, caption); }
    finally { setEnviandoMedia(false); }
  };

  const handleEnviarVoz = async (blob) => {
    if (!conversacionActiva || enviandoMedia) return;
    setEnviandoMedia(true);
    try { await enviarMedia('voice', blob, ''); }
    finally { setEnviandoMedia(false); }
  };

  const handleInputChange = (e) => {
    setTexto(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    const next = el.scrollHeight;
    el.style.height = `${next}px`;
    el.classList.toggle('has-overflow', next >= 180);
    if (conversacionActiva?.external_id && conversacionActiva?.empresa_id) {
      const now = Date.now();
      if (now - lastTypingRef.current > 4000) {
        lastTypingRef.current = now;
        apiService.sendTyping(conversacionActiva.external_id, conversacionActiva.empresa_id, conversacionActiva.canal)
          .catch(() => {});
      }
    }
  };

  // Resetear altura cuando se limpia el texto (al enviar o cambiar conversación)
  useEffect(() => {
    if (!texto && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.classList.remove('has-overflow');
    }
  }, [texto]);

  if (!conversacionActiva) {
    return (
      <div className="chat-window-panel">
        <div className="empty-chat">
          <div className="empty-content">
            <MessageCircle size={80} color="#bdc3c7" />
            <h2>Selecciona un chat</h2>
            <p>Elige una conversación para empezar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window-panel">
      <div className="chat-header">
        <div className="header-info">
          <button
            className="back-btn"
            onClick={() => setConversacionActiva(null)}
            style={{ marginRight: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#54656f', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={22} />
          </button>
          <div className="avatar"><User size={24} color="#fff" /></div>
          <div>
            <h3>{conversacionActiva.nombre || conversacionActiva.username}</h3>
            <p className="status">
              {clienteEscribiendo
                ? <span style={{ color: '#dc2626', fontStyle: 'italic' }}>escribiendo...</span>
                : conversacionActiva.telefono
                  ? conversacionActiva.telefono
                  : conversacionActiva.external_id}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="agent-select">
            <User size={14} style={{ marginRight: '5px' }} />
            Agente Fibratec
          </button>
          <button className="icon-btn-gray" onClick={() => cerrarConversacion(conversacionActiva.id)}>
            <Zap size={18} />
          </button>
          <button className="icon-btn-gray" onClick={() => eliminarConversacion(conversacionActiva.id)}>
            <Trash2 size={18} color="#e74c3c" />
          </button>
        </div>
      </div>

      <div className="messages-container" ref={containerRef}>
        {mensajes.map((m, idx) => {
          const fechaMsg  = m.created_at || m.fecha;
          const fechaPrev = idx > 0 ? (mensajes[idx - 1].created_at || mensajes[idx - 1].fecha) : null;
          const mostrarSeparador = !fechaPrev || !isSameDay(fechaMsg, fechaPrev);

          if (m.remitente === 'sistema' || m.remitente === 'sistema_info' || m.remitente === 'sistema_success') {
            const typeClass = m.remitente === 'sistema_info' ? 'info' : (m.remitente === 'sistema_success' ? 'success' : '');
            return (
              <React.Fragment key={idx}>
                {mostrarSeparador && (
                  <div className="day-separator"><span>{formatDaySeparator(fechaMsg)}</span></div>
                )}
                <div className={`message-system ${typeClass}`}>
                  {m.remitente === 'sistema_info'
                    ? <Activity size={14} style={{ marginRight: '8px' }} />
                    : <Zap      size={14} style={{ marginRight: '8px' }} />}
                  {m.texto}
                </div>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={idx}>
              {mostrarSeparador && (
                <div className="day-separator"><span>{formatDaySeparator(fechaMsg)}</span></div>
              )}
              <div className={`message-row ${m.remitente === 'user' ? 'received' : 'sent'}`}>
                {m.tipo === 'photo' ? (
                  <div className="message-bubble msg-bubble-photo">
                    <div className="msg-photo-wrap">
                      <img
                        src={resolveMedia(m.url_media)}
                        alt="imagen"
                        className="msg-photo"
                        onClick={() => window.open(resolveMedia(m.url_media), '_blank')}
                      />
                      {m.texto && m.texto !== '🖼 Imagen' && (
                        <p className="msg-photo-caption">{m.texto}</p>
                      )}
                      <div className="message-time msg-time-overlay">
                        {formatMsgTime(fechaMsg)}
                        {m.remitente !== 'user' && <MessageTick estado={m.estado} />}
                      </div>
                    </div>
                  </div>
                ) : m.tipo === 'voice' ? (
                  <VoicePlayer
                    src={resolveMedia(m.url_media)}
                    msgId={m.id}
                    fecha={fechaMsg}
                    estado={m.estado}
                    remitente={m.remitente}
                    formatMsgTime={formatMsgTime}
                    MessageTick={MessageTick}
                  />
                ) : (
                  <div className="message-bubble">
                    {m.tipo === 'sticker' ? (
                      <img src={resolveMedia(m.url_media)} alt="sticker" className="msg-media msg-sticker" />
                    ) : m.tipo === 'sticker_video' ? (
                      <video
                        src={resolveMedia(m.url_media)}
                        className="msg-media msg-sticker"
                        autoPlay loop muted playsInline
                      />
                    ) : m.tipo === 'location' ? (
                      <a
                        href={m.url_media}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="msg-location"
                      >
                        <span className="msg-location-pin">📍</span>
                        <span>Ver ubicación en Maps</span>
                      </a>
                    ) : (
                      <span className="msg-text">{renderTexto(m.texto)}</span>
                    )}
                    <div className="message-time">
                      {formatMsgTime(fechaMsg)}
                      {m.remitente !== 'user' && <MessageTick estado={m.estado} />}
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Burbuja de "está escribiendo..." */}
        {clienteEscribiendo && (
          <div className="message-row received">
            <div className="message-bubble typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

      </div>

      <div className="chat-input-area" style={{ position: 'relative' }}>
        {showEmojiPicker && (
          <div ref={pickerRef} className="emoji-picker-container">
            <Picker
              data={data}
              onEmojiSelect={(e) => {
                setTexto(prev => prev + e.native);
                inputRef.current?.focus();
              }}
              locale="es"
              theme="light"
              previewPosition="none"
              skinTonePosition="none"
            />
          </div>
        )}

        {/* Picker de respuestas rápidas — aparece al escribir "/" */}
        {showQRPicker && (
          <QuickReplyPicker
            query={slashQuery}
            items={respuestasRapidas}
            onSelect={handleSelectRR}
            onClose={() => setTexto('')}
          />
        )}

        <button
          className={`icon-btn-gray${showEmojiPicker ? ' active' : ''}`}
          onClick={() => setShowEmojiPicker(s => !s)}
          title="Emojis"
        >
          <Smile size={22} />
        </button>
        <MediaUpload onSend={handleEnviarFoto} disabled={enviandoMedia} />
        <button
          className="icon-btn-gray"
          title="Respuestas rápidas"
          onClick={() => setShowQRModal(true)}
        >
          <Zap size={20} />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          placeholder='Escribe un mensaje o "/" para respuestas rápidas...'
          value={texto}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !showQRPicker) {
              e.preventDefault();
              enviarMensaje();
            }
          }}
        />
        <VoiceRecorder onSend={handleEnviarVoz} disabled={enviandoMedia} />
        <button className="send-button-circle" onClick={enviarMensaje}>
          <Send size={20} color="#fff" />
        </button>
      </div>

      {showQRModal && (
        <QuickRepliesModal
          items={respuestasRapidas}
          onClose={() => setShowQRModal(false)}
          onChange={setRespuestasRapidas}
        />
      )}
    </div>
  );
};

export default ChatWindow;
