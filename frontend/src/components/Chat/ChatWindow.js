import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Zap, Trash2, Send, MessageCircle, Activity, Info, X, ArrowLeft, Smile, Check, CheckCheck, ArrowRightLeft, CheckCircle2, BookOpen, Briefcase, DollarSign, Wrench, Clock, Search, Lock, Copy, ChevronDown } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data/sets/15/apple.json';
import { apiService, resolveMedia } from '../../services/api';
import { formatMsgTime, formatDaySeparator, isSameDay } from '../../utils/formatDate';
import MediaUpload from './MediaUpload';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import QuickReplyPicker from './QuickReplyPicker';
import QuickRepliesModal from './QuickRepliesModal';
import StickerPicker from './StickerPicker';
import TransferLogPanel from '../Transferencias/TransferLogPanel';
import EtiquetasPicker from './EtiquetasPicker';
import PasteTableModal from './PasteTableModal';
import { isTableClipboardData, processClipboardTable, isTableText, extractTSVForExcel } from '../../utils/excelTableHelper';
import {
  renderContentWithAppleEmojis,
  countOnlyEmojis,
  textToAppleEmojiHtml,
  insertEmojiAtCursor,
  extractTextFromContentEditable,
} from '../../utils/appleEmojiHelper';
import '../../styles/media-upload.css';
import '../../styles/quick-replies.css';

/** Convierte URLs en el texto en elementos <a> clicables */
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

function formatInlineStyles(texto) {
  if (typeof texto !== 'string') return texto;
  const regex = /(`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  const partes = texto.split(regex);
  return partes.map((parte, i) => {
    if (parte.startsWith('`') && parte.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '90%',
            padding: '1px 4px',
            borderRadius: '4px',
            backgroundColor: 'rgba(0,0,0,0.08)'
          }}
        >
          {parte.slice(1, -1)}
        </code>
      );
    }
    if (parte.startsWith('*') && parte.endsWith('*')) {
      return <strong key={i}>{renderContentWithAppleEmojis(parte.slice(1, -1))}</strong>;
    }
    if (parte.startsWith('_') && parte.endsWith('_')) {
      return <em key={i}>{renderContentWithAppleEmojis(parte.slice(1, -1))}</em>;
    }
    if (parte.startsWith('~') && parte.endsWith('~')) {
      return <del key={i}>{renderContentWithAppleEmojis(parte.slice(1, -1))}</del>;
    }
    return <React.Fragment key={i}>{renderContentWithAppleEmojis(parte)}</React.Fragment>;
  });
}

function formatWhatsAppStyle(texto, isDarkMode = false) {
  if (typeof texto !== 'string') return texto;

  // Si contiene bloques de código multilínea tipo ``` ... ``` (como la cuadrícula visual de Excel)
  if (texto.includes('```')) {
    const codeBlocks = texto.split(/(```[\s\S]*?```)/g);
    return codeBlocks.map((block, idx) => {
      if (block.startsWith('```') && block.endsWith('```')) {
        const rawCode = block.slice(3, -3);
        const cleanCode = rawCode.replace(/^\n/, '').replace(/\n$/, '');
        return (
          <pre
            key={`code-block-${idx}`}
            className="wa-code-block"
            style={{
              margin: '4px 0',
              padding: '6px 8px',
              borderRadius: '6px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '12px',
              lineHeight: '1.4',
              overflowX: 'auto',
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.05)',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              whiteSpace: 'pre',
              tabSize: 8,
              MozTabSize: 8
            }}
          >
            <code>{cleanCode}</code>
          </pre>
        );
      }
      return formatInlineStyles(block);
    });
  }

  return formatInlineStyles(texto);
}

function renderTexto(texto, isDarkMode = false) {
  if (!texto) return null;

  // Emojis grandes si solo contiene 1, 2 o 3 emojis (congruencia con WhatsApp y Chat Interno)
  const onlyCount = countOnlyEmojis(texto);
  if (onlyCount > 0) {
    const size = onlyCount === 1 ? '3.2rem' : '2.2rem';
    return (
      <div className={`wa-emojis-only count-${onlyCount}`}>
        {renderContentWithAppleEmojis(texto, size)}
      </div>
    );
  }

  const partes = texto.split(URL_REGEX);
  return partes.map((parte, i) =>
    URL_REGEX.test(parte)
      ? <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="msg-link">{parte}</a>
      : formatWhatsAppStyle(parte, isDarkMode)
  );
}

/** Botón para copiar tablas o TSV directamente listo para Excel */
const TableCopyButton = ({ text, isDark = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    const tsv = extractTSVForExcel(text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      });
    }
  };

  return (
    <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: isDark ? '1px dashed rgba(255,255,255,0.15)' : '1px dashed rgba(0,0,0,0.1)' }}>
      <button
        type="button"
        className={`msg-copy-excel-btn ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title="Copiar celdas tabuladas para pegar directamente en Excel con Ctrl+V"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: '12px',
          border: isDark ? '1px solid #00a884' : '1px solid #107c41',
          backgroundColor: copied ? (isDark ? '#00a884' : '#107c41') : (isDark ? 'rgba(0,168,132,0.18)' : 'rgba(16,124,65,0.08)'),
          color: copied ? '#ffffff' : (isDark ? '#25d366' : '#107c41'),
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span>{copied ? '¡Celdas copiadas! Pega con Ctrl+V en Excel' : '📋 Copiar para Excel'}</span>
      </button>
    </div>
  );
};

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
const CanalIconSVG = ({ canal, size = 14 }) => {
  if (canal === 'whatsapp') return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>;
  if (canal === 'facebook') return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
  if (canal === 'telegram') return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>;
  if (canal === 'instagram') return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
  return <MessageCircle size={size} />;
};

const ChannelBadge = ({ canal, iconOnly = false }) => {
  const info = CANAL_INFO[canal] || { label: 'Chat', color: '#667781', bg: '#f0f2f5' };
  
  if (iconOnly) {
    return (
      <span style={{ color: info.color, display: 'flex', alignItems: 'center' }} title={info.label}>
        <CanalIconSVG canal={canal} size={18} />
      </span>
    );
  }

  return (
    <span className="canal-badge" style={{ color: info.color, background: info.bg, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <CanalIconSVG canal={canal} size={11} />
      {info.label}
    </span>
  );
};

const StickerBubble = ({ m, resolveMedia, savedWaStickers, handleSaveClientSticker, savingSticker }) => {
  const [mediaError, setMediaError] = useState(false);
  const url = resolveMedia(m.url_media);
  
  const showSaveBtn = m.remitente === 'user' && (m.url_media?.startsWith('wa://') || m.url_media?.startsWith('tg://'));
  const isSaved = savedWaStickers.has(m.url_media);
  const isSaving = savingSticker === m.url_media;

  // Intentamos img (WebP animados), y si falla intentamos video (MP4), y si falla enlace
  return (
    <div className="msg-sticker-wrap">
      {!mediaError ? (
        <img
          src={url}
          alt="sticker"
          className="msg-media msg-sticker"
          onError={() => setMediaError('video')}
        />
      ) : mediaError === 'video' ? (
        <video
          src={url}
          className="msg-media msg-sticker"
          autoPlay
          loop
          muted
          playsInline
          onError={() => setMediaError('failed')}
        />
      ) : (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="msg-media msg-sticker"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '120px', height: '120px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '12px', textAlign: 'center' }}
        >
          <span>⚠️<br/>Ver sticker</span>
        </a>
      )}
      {showSaveBtn && (
        <button
          className={`msg-sticker-save-btn${isSaved ? ' saved' : ''}`}
          title={isSaved ? 'Guardado en Mis stickers' : 'Guardar en Mis stickers'}
          onClick={() => handleSaveClientSticker(m.url_media)}
          disabled={isSaving}
        >
          {isSaving ? '…' : isSaved ? '♥' : '♡'}
        </button>
      )}
    </div>
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

    const differentAgent = m.agente_id && prev?.agente_id && prev.agente_id !== m.agente_id;

    const isFirst = !prev || prev.remitente !== m.remitente ||
                    prev.remitente?.startsWith('sistema') ||
                    t - tPrev >= GRUPO_VENTANA_MS ||
                    differentAgent;

    const differentAgentNext = m.agente_id && next?.agente_id && next.agente_id !== m.agente_id;

    const isLast  = !next || next.remitente !== m.remitente ||
                    next.remitente?.startsWith('sistema') ||
                    tNext - t >= GRUPO_VENTANA_MS ||
                    differentAgentNext;

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
const DEPTO_ICON = { Ventas: Briefcase, Cobranza: DollarSign, 'Soporte Técnico': Wrench };

function ResumenFlujo({ conv }) {
  const meta     = conv.metadata || {};
  const cliente  = meta.cliente;
  const servicio = cliente?.servicios?.[meta.servicio_idx ?? 0];
  const filas    = [
    ['Canal',       CANAL_INFO[conv.canal]?.label || conv.canal],
    ['Empresa',     conv.empresa_id],
    ['Estado',      ESTADO_LABEL[conv.estado] || conv.estado],
    conv.departamento && ['Área', (() => {
      const Icon = DEPTO_ICON[conv.departamento];
      return Icon
        ? <><Icon size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{conv.departamento}</>
        : conv.departamento;
    })()],
    cliente         && ['Cliente WISP', cliente.nombre],
    servicio        && ['Servicio',     servicio.etiqueta],
    servicio        && ['Deuda',        servicio.deuda > 0 ? `$${servicio.deuda.toFixed(2)} MXN` : <><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#16a34a' }} />Al corriente</>],
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

function InfoPanel({ conv, displayName, telefonoFmt, onClose }) {
  return (
    <>
      <div className="info-panel-header">
        <span className="info-panel-title">Ficha del contacto</span>
        <button className="info-panel-close" onClick={onClose} title="Cerrar ficha">
          <X size={16} />
        </button>
      </div>
      <div className="info-panel-body">
        <div className="info-panel-profile">
          <div className="info-panel-avatar" style={{ backgroundColor: 'transparent' }}>
            <img 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || conv?.id)}&backgroundColor=0284c7,0ea5e9,3b82f6,6366f1,8b5cf6&textColor=ffffff`} 
              alt="avatar" 
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
            />
          </div>
          <div className="info-panel-client-info">
            <div className="info-panel-name">{renderContentWithAppleEmojis(displayName)}</div>
            {telefonoFmt && <div className="info-panel-phone">{telefonoFmt}</div>}
            {conv.canal && (
              <div style={{ marginTop: '5px' }}>
                <ChannelBadge canal={conv.canal} />
              </div>
            )}
          </div>
        </div>
        <ResumenFlujo conv={conv} />
        <TransferLogPanel conversacion_id={conv?.id} />
      </div>
    </>
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
  transferirConversacion,
  eliminarConversacion,
  setConversacionActiva,
  clienteEscribiendo,
  user,
  darkMode,
}) => {
  const [pickerMode, setPickerMode] = useState(null); // null | 'emoji' | 'sticker'
  const [enviandoMedia,     setEnviandoMedia]     = useState(false);
  const [respuestasRapidas, setRespuestasRapidas] = useState([]);
  const [showQRModal,       setShowQRModal]       = useState(false);
  const [showInfoPanel,     setShowInfoPanel]     = useState(false);
  const [etiquetas,         setEtiquetas]         = useState([]);
  const [nuevosMensajesCount, setNuevosMensajesCount] = useState(0);
  const prevMensajesLengthRef = useRef(mensajes?.length || 0);
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
    setPickerMode(null);
    setNuevosMensajesCount(0);
    prevMensajesLengthRef.current = mensajes?.length || 0;
    // Cargar etiquetas de la conversación
    setEtiquetas([]);
    apiService.getEtiquetasConversacion(conversacionActiva.id)
      .then(data => setEtiquetas(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [conversacionActiva?.id]);

  // Scroll y detección de mensajes entrantes mientras la conversación está activa
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mensajes.length) return;

    const prevCount = prevMensajesLengthRef.current;
    const currentCount = mensajes.length;
    prevMensajesLengthRef.current = currentCount;

    if (cargaInicialRef.current) {
      el.scrollTop = el.scrollHeight;
      cargaInicialRef.current = false;
      setNuevosMensajesCount(0);
    } else if (currentCount > prevCount) {
      const ultimo = mensajes[currentCount - 1];
      const distanciaFondo = el.scrollHeight - el.scrollTop - el.clientHeight;

      if (ultimo?.remitente === 'user' && distanciaFondo >= 140) {
        // El cliente envió un mensaje pero el agente está scrolleado arriba: mostrar banner
        setNuevosMensajesCount(prev => prev + (currentCount - prevCount));
      } else {
        el.scrollTop = el.scrollHeight;
        setNuevosMensajesCount(0);
      }
    }
  }, [mensajes.length]);

  const handleScrollMessages = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setNuevosMensajesCount(0);
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
    setNuevosMensajesCount(0);
  };

  // Actualizar etiquetas en tiempo real (otro agente etiquetó esta conversación)
  useEffect(() => {
    const handler = (e) => {
      if (Number(e.detail?.conversacion_id) === Number(conversacionActiva?.id)) {
        setEtiquetas(e.detail.etiquetas || []);
      }
    };
    window.addEventListener('conversacion:etiquetas', handler);
    return () => window.removeEventListener('conversacion:etiquetas', handler);
  }, [conversacionActiva?.id]);

  // Cerrar el panel combinado emoji/stickers al hacer clic fuera
  useEffect(() => {
    if (!pickerMode) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerMode(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerMode]);

  const handleSelectRR = async (item) => {
    setTexto(''); // cierra el picker en todos los casos
    if (item.url_media) {
      // Media: enviar de inmediato, igual que un sticker
      if (!conversacionActiva) return;
      try {
        await apiService.usarRespuestaRapida(conversacionActiva.id, item.id);
      } catch (e) {
        alert(e.message || 'Error al enviar la respuesta rápida');
      }
    } else {
      // Solo texto: insertar en el input para que el agente lo revise/edite
      const cont = item.contenido || '';
      setTexto(cont);
      if (inputRef.current) {
        inputRef.current.innerHTML = textToAppleEmojiHtml(cont);
        const range = document.createRange();
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        inputRef.current.focus();
      }
    }
  };

  const handleSelectEmoji = (em) => {
    const emojiChar = typeof em === 'string' ? em : em?.native || '';
    if (!emojiChar) return;

    if (inputRef.current) {
      insertEmojiAtCursor(inputRef.current, emojiChar);
      const newText = extractTextFromContentEditable(inputRef.current);
      setTexto(newText);
    } else {
      setTexto(prev => prev + emojiChar);
    }
  };

  const handleEditableInput = () => {
    if (!inputRef.current) return;
    const txt = extractTextFromContentEditable(inputRef.current);
    setTexto(txt);
    if (conversacionActiva?.external_id && conversacionActiva?.empresa_id) {
      const now = Date.now();
      if (now - lastTypingRef.current > 4000) {
        lastTypingRef.current = now;
        apiService.sendTyping(conversacionActiva.external_id, conversacionActiva.empresa_id, conversacionActiva.canal, conversacionActiva.id)
          .catch(() => {});
      }
    }
  };

  const handleInsertPlainTextWithEmojis = (plain) => {
    if (inputRef.current) {
      inputRef.current.focus();
      const html = textToAppleEmojiHtml(plain);
      document.execCommand('insertHTML', false, html);
      const txt = extractTextFromContentEditable(inputRef.current);
      setTexto(txt);
    } else {
      setTexto(prev => prev + plain);
    }
  };

  const handleEnviarMensajeWrapper = async (textoDirecto) => {
    const txt = typeof textoDirecto === 'string'
      ? textoDirecto
      : (inputRef.current ? extractTextFromContentEditable(inputRef.current) : texto);
    if (!txt || !txt.trim()) return;
    setNuevosMensajesCount(0);
    if (inputRef.current) {
      inputRef.current.innerHTML = '';
    }
    setTexto('');
    await enviarMensaje(txt.trim());
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
  const [tableModalData,  setTableModalData]  = useState(null);
  const [generandoTabla,  setGenerandoTabla]  = useState(false);

  const handlePaste = async (e) => {
    // 1. Si se pega un archivo de imagen directo (captura de pantalla)
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const url = URL.createObjectURL(file);
            setTableModalData({
              blob: file,
              url,
              plainText: '',
              rowCount: 0,
              colCount: 0
            });
            return;
          }
        }
      }
    }

    // 2. Si se pega una tabla de Excel o Google Sheets
    if (isTableClipboardData(e.clipboardData)) {
      e.preventDefault();
      try {
        setGenerandoTabla(true);
        const res = await processClipboardTable(e.clipboardData, darkMode);
        setTableModalData(res);
      } catch (err) {
        console.warn('Error al procesar tabla como imagen, insertando como texto:', err);
        const plain = e.clipboardData?.getData('text/plain') || '';
        if (plain) {
          handleInsertPlainTextWithEmojis(plain);
        }
      } finally {
        setGenerandoTabla(false);
      }
      return;
    }

    // 3. Texto plano común: insertar con emojis de Apple si los contiene
    const plain = e.clipboardData?.getData('text/plain') || '';
    if (plain) {
      e.preventDefault();
      handleInsertPlainTextWithEmojis(plain);
    }
  };

  const handleSendPastedImage = async (blob, caption) => {
    await handleEnviarFoto(blob, caption);
  };

  const handleSendPastedText = async (text) => {
    if (!text || !text.trim()) return;
    await handleEnviarMensajeWrapper(text.trim());
  };

  const handleSendBoth = async (blob, caption, text) => {
    if (blob) {
      await handleEnviarFoto(blob, caption);
    }
    if (text && text.trim()) {
      setTimeout(async () => {
        await handleEnviarMensajeWrapper(text.trim());
      }, 400);
    }
  };

  const handlePastePastedText = (pastedText) => {
    const cur = inputRef.current ? extractTextFromContentEditable(inputRef.current) : texto;
    const sep = cur && !cur.endsWith('\n') ? '\n' : '';
    const full = cur + sep + pastedText;
    setTexto(full);
    if (inputRef.current) {
      inputRef.current.innerHTML = textToAppleEmojiHtml(full);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  };

  const handleCloseTableModal = () => {
    if (tableModalData?.url) {
      URL.revokeObjectURL(tableModalData.url);
    }
    setTableModalData(null);
  };

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

  // Sincronizar / limpiar input editable cuando se limpia texto o cambia de conversación
  useEffect(() => {
    if (!texto && inputRef.current && inputRef.current.innerHTML !== '') {
      inputRef.current.innerHTML = '';
    }
  }, [texto]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.innerHTML = '';
    }
    setTexto('');
  }, [conversacionActiva?.id]);

  if (!conversacionActiva) {
    return (
      <div className="chat-window-panel">
        <div className="chat-main wa-window-empty">
          <div className="wa-empty-state-card">
            <div className="wa-empty-icon-circle" style={{ width: 88, height: 88, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <img src="/fibri.png" alt="Fibri" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            </div>
            <h2 className="wa-empty-title">Chat Clientes Multicanal</h2>
            <p className="wa-empty-subtitle">
              Atiende y gestiona las conversaciones de WhatsApp, Telegram, Facebook e Instagram en tiempo real.
            </p>

            <div className="wa-empty-actions-row">
              <button
                type="button"
                className="wa-empty-action-btn"
                onClick={() => {
                  const searchInput = document.querySelector('.wa-search-input');
                  if (searchInput) {
                    searchInput.focus();
                  }
                }}
                title="Buscar un chat o cliente"
              >
                <div className="wa-empty-action-circle">
                  <Search size={20} />
                </div>
                <span className="wa-empty-action-label">Buscar cliente</span>
              </button>
            </div>

            <div className="wa-empty-lock-footer">
              <Lock size={13} />
              <span>Tus conversaciones con clientes están centralizadas y protegidas de extremo a extremo</span>
            </div>
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

  const mensajesFiltrados = mensajes;

  // Precomputar info de agrupamiento
  const groupInfo = computeGroupInfo(mensajesFiltrados);

  return (
    <div className="chat-window-panel">
      <div className="chat-main">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="header-info">
          <button
            className="back-btn"
            onClick={() => setConversacionActiva(null)}
            style={{ marginRight: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={22} />
          </button>
          <div className="avatar" style={{ backgroundColor: 'transparent', flexShrink: 0 }}>
            <img 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || conversacionActiva?.id)}&backgroundColor=0284c7,0ea5e9,3b82f6,6366f1,8b5cf6&textColor=ffffff`} 
              alt="avatar" 
              style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} 
            />
          </div>
          <div className="header-contact">
            <div className="header-contact-top">
              <h3 className="header-name">{renderContentWithAppleEmojis(displayName)}</h3>
              {conversacionActiva.canal && (
                <ChannelBadge canal={conversacionActiva.canal} iconOnly={true} />
              )}
            </div>
            {clienteEscribiendo ? (
              <p className="status" style={{ color: 'var(--accent)', fontStyle: 'italic' }}>escribiendo...</p>
            ) : (
              <p className="status">
                {subtitleLine && <span className="header-phone">{subtitleLine} · </span>}
                <span>{conversacionActiva.empresa_id}</span>
                {conversacionActiva.departamento && (
                  <span> · {conversacionActiva.departamento}</span>
                )}
              </p>
            )}
            <EtiquetasPicker
              conversacion={conversacionActiva}
              etiquetas={etiquetas}
              onEtiquetasChange={setEtiquetas}
            />
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center' }}>
          {conversacionActiva.agente_nombre && (
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)', marginRight: '12px', display: 'flex', alignItems: 'center' }}>
              Atendido por: <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>{conversacionActiva.agente_nombre}</span>
            </span>
          )}
          <button
            className={`icon-btn-gray info-panel-toggle${showInfoPanel ? ' active' : ''}`}
            onClick={() => setShowInfoPanel(s => !s)}
            title={showInfoPanel ? 'Cerrar ficha' : 'Ficha del contacto'}
          >
            <Info size={17} />
          </button>
          {/* Botón de transferencia: visible cuando el chat está activo (no cerrado/encuesta) */}
          {conversacionActiva.es_humano && !['cerrada','ENCUESTA_AGENTE','ENCUESTA_BOT'].includes(conversacionActiva.estado) && (
            <button
              className="icon-btn-gray"
              title="Transferir chat"
              onClick={() => transferirConversacion(conversacionActiva.id)}
              style={{ color: '#3b82f6' }}
            >
              <ArrowRightLeft size={17} />
            </button>
          )}
          <button
            className="icon-btn-gray"
            onClick={() => cerrarConversacion(conversacionActiva.id)}
            title={['cerrada','ENCUESTA_AGENTE','ENCUESTA_BOT'].includes(conversacionActiva.estado) ? 'Conversación ya cerrada' : 'Resolver y cerrar chat'}
            disabled={['cerrada','ENCUESTA_AGENTE','ENCUESTA_BOT'].includes(conversacionActiva.estado)}
          >
            <CheckCircle2 size={18} />
          </button>
          <button className="icon-btn-gray" onClick={() => eliminarConversacion(conversacionActiva.id)}>
            <Trash2 size={18} color="#e74c3c" />
          </button>
        </div>
      </div>

      {/* ── Mensajes ───────────────────────────────────────────── */}
      <div className="messages-container" ref={containerRef} onScroll={handleScrollMessages}>

        {/* Banner de nota de transferencia (visible mientras no ha sido tomado) */}
        {conversacionActiva.nota_transferencia && (
          <div className="transfer-note-banner">
            <ArrowRightLeft size={14} style={{ flexShrink: 0 }} />
            <div>
              <span className="transfer-note-label">Nota de transferencia:</span>{' '}
              {conversacionActiva.nota_transferencia}
              {conversacionActiva.transferida_desde && (
                <span className="transfer-note-origin"> · Desde {conversacionActiva.transferida_desde}</span>
              )}
            </div>
          </div>
        )}

        {mensajesFiltrados.map((m, idx) => {
          const fechaMsg   = m.created_at || m.fecha;
          const fechaPrev  = idx > 0 ? (mensajesFiltrados[idx - 1].created_at || mensajesFiltrados[idx - 1].fecha) : null;
          const mostrarSep = !fechaPrev || !isSameDay(fechaMsg, fechaPrev);
          const { isFirst, isLast } = groupInfo[idx] || { isFirst: true, isLast: true };

          if (m.remitente === 'sistema' || m.remitente === 'sistema_info' || m.remitente === 'sistema_success') {
            const typeClass = m.remitente === 'sistema_info' ? 'info' : (m.remitente === 'sistema_success' ? 'success' : '');
            
            const renderSystemIcon = (msg) => {
              const textLower = msg.texto.toLowerCase();
              if (textLower.includes('espera')) return <Clock size={15} style={{ marginRight: '8px', flexShrink: 0 }} />;
              if (textLower.includes('recurrente')) return <Activity size={15} style={{ marginRight: '8px', flexShrink: 0 }} />;
              if (msg.remitente === 'sistema_success') return <CheckCircle2 size={15} style={{ marginRight: '8px', flexShrink: 0 }} />;
              if (textLower.includes('directamente')) return <User size={15} style={{ marginRight: '8px', flexShrink: 0 }} />;
              if (textLower.includes('transferencia') || textLower.includes('transferido') || textLower.includes('devuelto a cola')) return <ArrowRightLeft size={15} style={{ marginRight: '8px', flexShrink: 0 }} />;
              return <Info size={15} style={{ marginRight: '8px', flexShrink: 0 }} />;
            };

            let textoVisible = m.texto;
            if (m.remitente === 'sistema_info' && user?.nombre) {
              const strTarget = `asignó este chat a ${user.nombre}`;
              if (textoVisible.includes(strTarget)) {
                textoVisible = textoVisible.replace(strTarget, 'te asignó este chat');
              }
            }

            return (
              <React.Fragment key={idx}>
                {mostrarSep && <div className="day-separator"><span>{formatDaySeparator(fechaMsg)}</span></div>}
                <div className={`message-system ${typeClass}`}>
                  {renderSystemIcon(m)}
                  <span>{renderContentWithAppleEmojis(textoVisible)}</span>
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
                  {isBot ? 'Bot' : (m.agente_nombre || 'Agente')}
                </div>
              )}

              <div className={rowCls} style={{ marginBottom: isLast ? '6px' : '1px' }}>
                {(m.tipo === 'photo' || m.tipo === 'image') && m.url_media ? (
                  <div className="message-bubble msg-bubble-photo">
                    <div className="msg-photo-wrap">
                      <img
                        src={resolveMedia(m.url_media)}
                        alt="imagen"
                        className="msg-photo"
                        onClick={() => window.open(resolveMedia(m.url_media), '_blank')}
                      />
                      {m.texto && m.texto !== '🖼 Imagen' && (
                        <p className="msg-photo-caption">{renderTexto(m.texto, darkMode)}</p>
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
                  <div className={`message-bubble${countOnlyEmojis(m.texto) > 0 ? ' msg-bubble-emojis-only' : ''}`}>
                    {['sticker', 'sticker_video', 'sticker_animado'].includes(m.tipo) ? (
                      <StickerBubble 
                        m={m} 
                        resolveMedia={resolveMedia} 
                        savedWaStickers={savedWaStickers} 
                        handleSaveClientSticker={handleSaveClientSticker} 
                        savingSticker={savingSticker} 
                      />
                    ) : m.tipo === 'location' ? (
                      <a href={m.url_media} target="_blank" rel="noopener noreferrer" className="msg-location">
                        <span className="msg-location-pin">📍</span>
                        <span className="msg-location-body">
                          {m.texto && m.texto !== 'Ubicación' && (
                            <span className="msg-location-name">{renderContentWithAppleEmojis(m.texto)}</span>
                          )}
                          <span className="msg-location-link">Ver en Google Maps</span>
                        </span>
                      </a>
                    ) : m.tipo === 'document' && m.url_media ? (
                      <a
                        href={resolveMedia(m.url_media)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="msg-document"
                      >
                        <span className="msg-doc-icon">📎</span>
                        <span className="msg-doc-name">{renderContentWithAppleEmojis(m.texto || 'Documento')}</span>
                      </a>
                    ) : (
                      <span
                        className={`msg-text${isTableText(m.texto) ? ' msg-table-text' : ''}`}
                        style={isTableText(m.texto) ? { tabSize: 8, MozTabSize: 8, whiteSpace: 'pre-wrap', display: 'block' } : undefined}
                      >
                        {renderTexto(m.texto, darkMode)}
                        {isTableText(m.texto) && <TableCopyButton text={m.texto} isDark={darkMode} />}
                      </span>
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

      {/* Banner flotante temporal "X nuevo(s) mensaje(s)" estilo WhatsApp */}
      {nuevosMensajesCount > 0 && (
        <button
          type="button"
          className="wa-unread-floating-banner"
          onClick={scrollToBottom}
          title="Bajar a los nuevos mensajes"
        >
          <ChevronDown size={15} color="#00a884" />
          <span>
            {nuevosMensajesCount === 1 ? '1 nuevo mensaje' : `${nuevosMensajesCount} nuevos mensajes`}
          </span>
        </button>
      )}

      <div className="chat-input-area" style={{ position: 'relative' }}>
        {/* Panel combinado Emoji / Stickers */}
        {pickerMode && (
          <div ref={pickerRef} className="esp-panel">
            <div className="esp-tab-bar">
              <button
                className={`esp-tab${pickerMode === 'emoji' ? ' active' : ''}`}
                onClick={() => setPickerMode('emoji')}
              >
                😀 Emoji
              </button>
              <button
                className={`esp-tab${pickerMode === 'sticker' ? ' active' : ''}`}
                onClick={() => setPickerMode('sticker')}
              >
                🎭 Stickers
              </button>
            </div>
            {pickerMode === 'emoji' ? (
              <Picker
                data={data}
                set="apple"
                onEmojiSelect={(em) => handleSelectEmoji(em)}
                locale="es"
                theme={darkMode ? 'dark' : 'light'}
                previewPosition="none"
                skinTonePosition="none"
              />
            ) : (
              <StickerPicker
                onSelect={handleEnviarSticker}
                onClose={() => setPickerMode(null)}
                agenteId={user?.id}
                embedded
              />
            )}
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

        {stickerError && (
          <div className="sticker-send-error">{stickerError}</div>
        )}

        <div className="chat-input-tools">
          <button
            className={`icon-btn-gray${pickerMode ? ' active' : ''}`}
            onClick={() => setPickerMode(m => m ? null : 'emoji')}
            title="Emoji y Stickers"
          >
            <Smile size={20} />
          </button>
          <MediaUpload onSend={handleEnviarFoto} disabled={enviandoMedia} />
          <button
            className="icon-btn-gray"
            title="Respuestas rápidas (o escribe /)"
            onClick={() => setShowQRModal(true)}
          >
            <BookOpen size={20} />
          </button>
        </div>
        <div className="chat-input-divider" />
        <div className="chat-input-wrapper" onClick={() => inputRef.current?.focus()}>
          <div
            ref={inputRef}
            className="wa-textarea wa-textarea-editable"
            contentEditable
            role="textbox"
            aria-multiline="true"
            data-placeholder='Escribe un mensaje o "/" para respuestas rápidas...'
            onInput={handleEditableInput}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !showQRPicker) {
                e.preventDefault();
                handleEnviarMensajeWrapper();
              }
            }}
          />
        </div>
        <VoiceRecorder onSend={handleEnviarVoz} disabled={enviandoMedia} />
        <button className="send-button-circle" onClick={() => handleEnviarMensajeWrapper()} title="Enviar mensaje">
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

      {/* Modal para previsualizar tabla de Excel como captura o texto */}
      {tableModalData && (
        <PasteTableModal
          isOpen={Boolean(tableModalData)}
          tableBlob={tableModalData.blob}
          imageUrl={tableModalData.url}
          tableText={tableModalData.plainText}
          tsvText={tableModalData.tsvText}
          gridText={tableModalData.gridText}
          listText={tableModalData.listText}
          rowCount={tableModalData.rowCount}
          colCount={tableModalData.colCount}
          onSendImage={handleSendPastedImage}
          onSendText={handleSendPastedText}
          onSendBoth={handleSendBoth}
          onPasteText={handlePastePastedText}
          onClose={handleCloseTableModal}
          isDarkMode={darkMode}
        />
      )}

      {generandoTabla && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '30px',
          backgroundColor: darkMode ? '#202c33' : '#ffffff',
          color: darkMode ? '#e9edef' : '#111b21',
          padding: '10px 18px',
          borderRadius: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          border: darkMode ? '1px solid #2a3942' : '1px solid #e2e8f0'
        }}>
          <span className="media-spinner" style={{ width: '14px', height: '14px' }} />
          <span>Generando captura de tabla Excel...</span>
        </div>
      )}
      </div>{/* /chat-main */}

      {/* ── Panel lateral de información ───────────────────────── */}
      <div className={`info-panel${showInfoPanel ? ' open' : ''}`}>
        {showInfoPanel && (
          <InfoPanel
            conv={conversacionActiva}
            displayName={displayName}
            telefonoFmt={telefonoFmt}
            onClose={() => setShowInfoPanel(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
