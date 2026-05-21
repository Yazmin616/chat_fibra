import React, { useState, useRef, useEffect } from 'react';
import { User, Zap, Trash2, Box, Send, MessageCircle, Activity, ArrowLeft, Smile, Check, CheckCheck } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { apiService, resolveMedia } from '../../services/api';
import { formatMsgTime, formatDaySeparator, isSameDay } from '../../utils/formatDate';

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
  cerrarConversacion,
  eliminarConversacion,
  setConversacionActiva,
  clienteEscribiendo
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef      = useRef(null);
  const inputRef       = useRef(null);
  const lastTypingRef  = useRef(0);
  const containerRef      = useRef(null);
  const cargaInicialRef   = useRef(false);

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
      // Carga inicial: ir al fondo sin condición ni animación
      el.scrollTop = el.scrollHeight;
      cargaInicialRef.current = false;
    } else {
      // Mensaje nuevo entrante: solo bajar si ya estaba cerca del fondo
      const distanciaFondo = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanciaFondo < 200) el.scrollTop = el.scrollHeight;
    }
  }, [mensajes.length]);

  // Cerrar picker al hacer clic fuera
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

  const handleInputChange = (e) => {
    setTexto(e.target.value);
    // Enviar "escribiendo..." a Telegram máximo una vez cada 4 segundos
    if (conversacionActiva?.external_id && conversacionActiva?.empresa_id) {
      const now = Date.now();
      if (now - lastTypingRef.current > 4000) {
        lastTypingRef.current = now;
        apiService.sendTyping(conversacionActiva.external_id, conversacionActiva.empresa_id, conversacionActiva.canal)
          .catch(() => {});
      }
    }
  };

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
                <div className="message-bubble">
                  {m.tipo === 'sticker' ? (
                    <img src={resolveMedia(m.url_media)} alt="sticker" className="msg-media msg-sticker" />
                  ) : m.tipo === 'sticker_video' ? (
                    <video
                      src={resolveMedia(m.url_media)}
                      className="msg-media msg-sticker"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : m.tipo === 'photo' ? (
                    <img
                      src={resolveMedia(m.url_media)}
                      alt="imagen"
                      className="msg-media msg-photo"
                      onClick={() => window.open(resolveMedia(m.url_media), '_blank')}
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
                    m.texto
                  )}
                  <div className="message-time">
                    {formatMsgTime(fechaMsg)}
                    {m.remitente !== 'user' && <MessageTick estado={m.estado} />}
                  </div>
                </div>
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

      <div className="chat-input-area">
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
        <button
          className={`icon-btn-gray${showEmojiPicker ? ' active' : ''}`}
          onClick={() => setShowEmojiPicker(s => !s)}
          title="Emojis"
        >
          <Smile size={22} />
        </button>
        <button className="icon-btn-gray" title="Adjuntar"><Box size={20} /></button>
        <button className="icon-btn-gray" title="Respuesta rápida"><Zap size={20} /></button>
        <input
          ref={inputRef}
          type="text"
          placeholder="Escribe un mensaje..."
          value={texto}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
        />
        <button className="send-button-circle" onClick={enviarMensaje}>
          <Send size={20} color="#fff" />
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
