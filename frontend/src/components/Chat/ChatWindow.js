import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Zap, Trash2, Send, MessageCircle, Activity, ArrowLeft, Smile, Check, CheckCheck, Layers } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { apiService, resolveMedia } from '../../services/api';
import { formatMsgTime, formatDaySeparator, isSameDay } from '../../utils/formatDate';
import MediaUpload from './MediaUpload';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import QuickReplyPicker from './QuickReplyPicker';
import QuickRepliesModal from './QuickRepliesModal';
import StickerPicker from './StickerPicker';
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

// ── Utilidades de contacto ────────────────────────────────────────────────────

/**
 * Devuelve el nombre real si es un nombre de persona, o null si es un identificador técnico.
 * - PSIDs/IGSIDs: strings numéricos largos (≥ 10 dígitos)
 * - Teléfonos crudos sin formato: también se descartan aquí
 */
function getNombreReal(nombre, externalId) {
  if (!nombre || nombre === externalId) return null;
  if (/^\d{8,}$/.test(nombre)) return null; // PSID, IGSID o teléfono crudo
  return nombre;
}

/**
 * Fallback de nombre según el canal cuando no hay nombre real.
 * WhatsApp/Telegram → formatea el número como teléfono.
 * Messenger/Instagram → nunca mostrar el PSID; usar etiqueta del canal.
 */
const CANAL_NOMBRE_FALLBACK = {
  facebook:  'Usuario de Facebook',
  instagram: 'Usuario de Instagram',
};

/** Formatea un número E.164 de México a "+52 712 183 0565". Solo para WhatsApp/Telegram. */
function formatPhoneMX(raw, canal) {
  // Para canales Meta que no usan teléfonos como ID, no formatear
  if (canal === 'facebook' || canal === 'instagram') return null;
  if (!raw) return null;
  const num = raw.replace(/\D/g, '');
  if (num.length < 10) return null; // No parece un teléfono
  // 521XXXXXXXXXX (13 dígitos) o 52XXXXXXXXXX (12 dígitos)
  const digits =
    num.startsWith('521') && num.length === 13 ? num.slice(3) :
    num.startsWith('52')  && num.length === 12 ? num.slice(2) : null;
  if (digits) return `+52 ${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  if (num.length <= 15) return `+${num}`; // Otro país
  return null; // PSID largo — no es teléfono
}

/** Badge de canal con color propio. */
const CANAL_INFO = {
  whatsapp:  { label: 'WhatsApp', color: '#25d366', bg: '#e8faf0' },
  telegram:  { label: 'Telegram', color: '#0088cc', bg: '#e8f5fd' },
  facebook:  { label: 'Facebook', color: '#1877f2', bg: '#e8f0fe' },
  instagram: { label: 'Instagram',color: '#c13584', bg: '#fde8f5' },
};
const ChannelBadge = ({ canal }) => {
  const info = CANAL_INFO[canal] || { label: 'Chat', color: '#667781', bg: '#f0f2f5' };
  return (
    <span className="canal-badge" style={{ color: info.color, background: info.bg }}>
      {info.label}
    </span>
  );
};

// ── Agrupamiento de mensajes ──────────────────────────────────────────────────

const GRUPO_VENTANA_MS = 60_000; // 60 segundos

/**
 * Para cada mensaje indica si es el primero / último de su grupo.
 * Grupos: mensajes consecutivos del mismo remitente enviados en < 60 s.
 * Los mensajes de sistema siempre son su propio grupo.
 */
function computeGroupInfo(mensajes) {
  return mensajes.map((m, i) => {
    if (m.remitente?.startsWith('sistema')) return { isFirst: true, isLast: true };
    const prev = mensajes[i - 1];
    const next = mensajes[i + 1];
    const t     = new Date(m.created_at || m.fecha).getTime();
    const tPrev = prev ? new Date(prev.created_at || prev.fecha).getTime() : null;
    const tNext = next ? new Date(next.created_at || next.fecha).getTime() : null;

    const isFirst = !prev || prev.remitente !== m.remitente ||
                    prev.remitente?.startsWith('sistema') ||
                    t - tPrev >= GRUPO_VENTANA_MS;

    const isLast  = !next || next.remitente !== m.remitente ||
                    next.remitente?.startsWith('sistema') ||
                    tNext - t >= GRUPO_VENTANA_MS;

    return { isFirst, isLast };
  });
}

// ── Vista resumen del flujo ───────────────────────────────────────────────────

const ESTADO_LABEL = {
  ESPERANDO_AGENTE: 'Esperando agente',
  atendiendo:       'Atendiendo',
  ENCUESTA_AGENTE:  'Encuesta',
  ENCUESTA_BOT:     'Encuesta bot',
  cerrada:          'Cerrada',
};
const DEPTO_ICON = { Ventas: '💼', Cobranza: '💰', 'Soporte Técnico': '🔧' };

function ResumenFlujo({ conv }) {
  const meta     = conv.metadata || {};
  const cliente  = meta.cliente;
  const servicio = cliente?.servicios?.[meta.servicio_idx ?? 0];
  const filas    = [
    ['Canal',       CANAL_INFO[conv.canal]?.label || conv.canal],
    ['Empresa',     conv.empresa_id],
    ['Estado',      ESTADO_LABEL[conv.estado] || conv.estado],
    conv.departamento && ['Área', `${DEPTO_ICON[conv.departamento] || ''} ${conv.departamento}`],
    cliente         && ['Cliente WISP', cliente.nombre],
    servicio        && ['Servicio',     servicio.etiqueta],
    servicio        && ['Deuda',        servicio.deuda > 0 ? `$${servicio.deuda.toFixed(2)} MXN` : 'Al corriente ✅'],
    servicio        && ['Vencimiento',  servicio.fecha_vencimiento],
    meta.identificado_via_wisp !== undefined && ['Identificado', meta.identificado_via_wisp ? 'Sí (datos guardados)' : 'Consulta de sesión'],
    meta.consulta_ajena && ['Consulta',  'Por otra persona'],
  ].filter(Boolean);

  return (
    <div className="resumen-flujo">
      <p className="resumen-titulo">Datos del flujo</p>
      <table className="resumen-table">
        <tbody>
          {filas.map(([campo, valor]) => (
            <tr key={campo}>
              <td className="resumen-campo">{campo}</td>
              <td className="resumen-valor">{valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ChatWindow = ({
  conversacionActiva,
  mensajes,
  setMensajes,
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
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [enviandoMedia,     setEnviandoMedia]     = useState(false);
  const [respuestasRapidas, setRespuestasRapidas] = useState([]);
  const [showQRModal,       setShowQRModal]       = useState(false);
  const [showResumen,       setShowResumen]       = useState(true);
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
  // y resetea estado local de stickers al cambiar de conversación
  useEffect(() => {
    if (!conversacionActiva) return;
    cargaInicialRef.current = true;
    setSavedWaStickers(new Set());
    setSavingSticker(null);
    setStickerError('');
    setShowStickerPicker(false);
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

  const [stickerError,    setStickerError]    = useState('');
  const [savedWaStickers, setSavedWaStickers] = useState(new Set());
  const [savingSticker,   setSavingSticker]   = useState(null);

  const handleEnviarSticker = async (pack, file) => {
    if (!conversacionActiva || enviandoMedia) return;
    if (conversacionActiva.canal !== 'whatsapp') {
      setStickerError('Los stickers solo están disponibles en conversaciones de WhatsApp.');
      setTimeout(() => setStickerError(''), 4000);
      return;
    }

    // Validar formato antes de mostrar — WA solo acepta .webp
    const ext = file.split('.').pop().toLowerCase();
    if (ext !== 'webp') {
      setStickerError(`WhatsApp solo admite stickers .webp. Sube "${file}" en formato WebP.`);
      setTimeout(() => setStickerError(''), 5000);
      return;
    }

    // Mostrar el sticker inmediatamente (display optimista)
    const tempId = `_stk_${Date.now()}`;
    setMensajes(prev => [...prev, {
      id:         tempId,
      remitente:  'agente',
      texto:      '🎭 Sticker',
      tipo:       'sticker',
      url_media:  `st://${pack}/${file}`,
      estado:     'enviado',
      created_at: new Date(),
    }]);

    setEnviandoMedia(true);
    try {
      const result = await apiService.enviarSticker(conversacionActiva.id, user?.id, pack, file);
      // Reemplazar ID temporal con el real para que el dedup del socket lo ignore
      setMensajes(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: result.mensaje_id } : m
      ));
    } catch (err) {
      // Revertir el sticker optimista si falló
      setMensajes(prev => prev.filter(m => m.id !== tempId));
      setStickerError(err.message || 'Error al enviar el sticker.');
      setTimeout(() => setStickerError(''), 4000);
    } finally {
      setEnviandoMedia(false);
    }
  };

  const handleSaveClientSticker = async (url_media) => {
    if (!user?.id || savingSticker) return;
    setSavingSticker(url_media);
    try {
      await apiService.saveClientSticker(user.id, url_media);
      setSavedWaStickers(prev => new Set([...prev, url_media]));
    } catch (err) {
      setStickerError(err.message || 'No se pudo guardar el sticker.');
      setTimeout(() => setStickerError(''), 4000);
    } finally {
      setSavingSticker(null);
    }
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
        apiService.sendTyping(conversacionActiva.external_id, conversacionActiva.empresa_id, conversacionActiva.canal, conversacionActiva.id)
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

  // Nombre y teléfono formateados según el canal
  const canal        = conversacionActiva?.canal;
  const nombreReal   = getNombreReal(conversacionActiva?.nombre, conversacionActiva?.external_id);
  const telefonoFmt  = formatPhoneMX(conversacionActiva?.external_id || conversacionActiva?.telefono, canal);
  const canalFallback = CANAL_NOMBRE_FALLBACK[canal] || null;
  const displayName  = nombreReal || telefonoFmt || canalFallback || conversacionActiva?.username || '—';
  const subtitleLine = nombreReal ? (telefonoFmt || null) : null;

  // Precomputar info de agrupamiento
  const groupInfo = computeGroupInfo(mensajes);

  return (
    <div className="chat-window-panel">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="header-info">
          <button
            className="back-btn"
            onClick={() => setConversacionActiva(null)}
            style={{ marginRight: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#54656f', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={22} />
          </button>
          <div className="avatar"><User size={24} color="#fff" /></div>
          <div className="header-contact">
            <div className="header-contact-top">
              <h3 className="header-name">{displayName}</h3>
              {conversacionActiva.canal && (
                <ChannelBadge canal={conversacionActiva.canal} />
              )}
            </div>
            {clienteEscribiendo ? (
              <p className="status" style={{ color: '#dc2626', fontStyle: 'italic' }}>escribiendo...</p>
            ) : (
              <p className="status">
                {subtitleLine && <span className="header-phone">{subtitleLine} · </span>}
                <span>{conversacionActiva.empresa_id}</span>
                {conversacionActiva.departamento && (
                  <span> · {conversacionActiva.departamento}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn-gray resumen-toggle${showResumen ? ' active' : ''}`}
            onClick={() => setShowResumen(s => !s)}
            title={showResumen ? 'Ver conversación completa' : 'Ver resumen'}
          >
            <Activity size={17} />
          </button>
          <button className="icon-btn-gray" onClick={() => cerrarConversacion(conversacionActiva.id)}>
            <Zap size={18} />
          </button>
          <button className="icon-btn-gray" onClick={() => eliminarConversacion(conversacionActiva.id)}>
            <Trash2 size={18} color="#e74c3c" />
          </button>
        </div>
      </div>

      {/* ── Vista resumen ──────────────────────────────────────── */}
      {showResumen && <ResumenFlujo conv={conversacionActiva} />}

      {/* ── Mensajes ───────────────────────────────────────────── */}
      <div className="messages-container" ref={containerRef}>
        {mensajes.map((m, idx) => {
          const fechaMsg   = m.created_at || m.fecha;
          const fechaPrev  = idx > 0 ? (mensajes[idx - 1].created_at || mensajes[idx - 1].fecha) : null;
          const mostrarSep = !fechaPrev || !isSameDay(fechaMsg, fechaPrev);
          const { isFirst, isLast } = groupInfo[idx] || { isFirst: true, isLast: true };

          if (m.remitente === 'sistema' || m.remitente === 'sistema_info' || m.remitente === 'sistema_success') {
            const typeClass = m.remitente === 'sistema_info' ? 'info' : (m.remitente === 'sistema_success' ? 'success' : '');
            return (
              <React.Fragment key={idx}>
                {mostrarSep && <div className="day-separator"><span>{formatDaySeparator(fechaMsg)}</span></div>}
                <div className={`message-system ${typeClass}`}>
                  {m.remitente === 'sistema_info'
                    ? <Activity size={14} style={{ marginRight: '8px' }} />
                    : <Zap      size={14} style={{ marginRight: '8px' }} />}
                  {m.texto}
                </div>
              </React.Fragment>
            );
          }

          const isUser  = m.remitente === 'user';
          const isBot   = m.remitente === 'bot';
          const rowCls  = [
            'message-row',
            isUser ? 'received' : 'sent',
            isBot  ? 'is-bot'   : '',
            !isFirst ? 'no-tail' : '',
          ].filter(Boolean).join(' ');

          return (
            <React.Fragment key={idx}>
              {mostrarSep && <div className="day-separator"><span>{formatDaySeparator(fechaMsg)}</span></div>}

              {/* Etiqueta de remitente (solo en primer mensaje del grupo) */}
              {isFirst && !isUser && (
                <div className={`sender-label ${isUser ? 'received' : 'sent'}`}>
                  {isBot ? 'Bot' : 'Agente'}
                </div>
              )}

              <div className={rowCls} style={{ marginBottom: isLast ? '6px' : '1px' }}>
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
                        {isLast && formatMsgTime(fechaMsg)}
                        {isLast && m.remitente !== 'user' && <MessageTick estado={m.estado} />}
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
                    showTime={isLast}
                  />
                ) : (
                  <div className="message-bubble">
                    {m.tipo === 'sticker' ? (
                      <div className="msg-sticker-wrap">
                        <img
                          src={resolveMedia(m.url_media)}
                          alt="sticker"
                          className="msg-media msg-sticker"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        {m.remitente === 'user' && (m.url_media?.startsWith('wa://') || m.url_media?.startsWith('tg://')) && (
                          <button
                            className={`msg-sticker-save-btn${savedWaStickers.has(m.url_media) ? ' saved' : ''}`}
                            title={savedWaStickers.has(m.url_media) ? 'Guardado en Mis stickers' : 'Guardar en Mis stickers'}
                            onClick={() => handleSaveClientSticker(m.url_media)}
                            disabled={savingSticker === m.url_media}
                          >
                            {savingSticker === m.url_media ? '…' : savedWaStickers.has(m.url_media) ? '♥' : '♡'}
                          </button>
                        )}
                      </div>
                    ) : m.tipo === 'sticker_video' ? (
                      <div className="msg-sticker-wrap">
                        <video src={resolveMedia(m.url_media)} className="msg-media msg-sticker" autoPlay loop muted playsInline />
                        {m.remitente === 'user' && (m.url_media?.startsWith('wa://') || m.url_media?.startsWith('tg://')) && (
                          <button
                            className={`msg-sticker-save-btn${savedWaStickers.has(m.url_media) ? ' saved' : ''}`}
                            title={savedWaStickers.has(m.url_media) ? 'Guardado en Mis stickers' : 'Guardar en Mis stickers'}
                            onClick={() => handleSaveClientSticker(m.url_media)}
                            disabled={savingSticker === m.url_media}
                          >
                            {savingSticker === m.url_media ? '…' : savedWaStickers.has(m.url_media) ? '♥' : '♡'}
                          </button>
                        )}
                      </div>
                    ) : m.tipo === 'location' ? (
                      <a href={m.url_media} target="_blank" rel="noopener noreferrer" className="msg-location">
                        <span className="msg-location-pin">📍</span>
                        <span className="msg-location-body">
                          {m.texto && m.texto !== 'Ubicación' && (
                            <span className="msg-location-name">{m.texto}</span>
                          )}
                          <span className="msg-location-link">Ver en Google Maps</span>
                        </span>
                      </a>
                    ) : (
                      <span className="msg-text">{renderTexto(m.texto)}</span>
                    )}
                    {isLast && (
                      <div className="message-time">
                        {formatMsgTime(fechaMsg)}
                        {m.remitente !== 'user' && <MessageTick estado={m.estado} />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {clienteEscribiendo && (
          <div className="message-row received">
            <div className="message-bubble typing-bubble">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
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

        {showStickerPicker && (
          <StickerPicker
            onSelect={handleEnviarSticker}
            onClose={() => setShowStickerPicker(false)}
            agenteId={user?.id}
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
        <button
          className={`icon-btn-gray${showStickerPicker ? ' active' : ''}`}
          title={conversacionActiva?.canal !== 'whatsapp' ? 'Stickers (solo WhatsApp)' : 'Stickers'}
          onClick={() => setShowStickerPicker(s => !s)}
          disabled={enviandoMedia || conversacionActiva?.canal !== 'whatsapp'}
          style={conversacionActiva?.canal !== 'whatsapp' ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          <Layers size={20} />
        </button>
        {stickerError && (
          <div className="sticker-send-error">{stickerError}</div>
        )}
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
