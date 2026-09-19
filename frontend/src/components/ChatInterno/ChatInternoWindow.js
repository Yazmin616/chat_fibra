import React, { useState, useRef, useEffect } from 'react';
import {
  Hash, Lock, Send, Paperclip, File as FileIcon, Download,
  X, Info, Shield, ShieldAlert, User, Pin,
  Smile, Check, CheckCheck, CornerUpLeft, Search, ChevronDown,
  Mic, Plus, Copy, Edit3, Trash2, Heart, Sparkles, Star
} from 'lucide-react';
import { API_URL, resolveAvatar, resolveMedia, apiService } from '../../services/api';
import ChatInternoAudioPlayer from './ChatInternoAudioPlayer';
import ChatInternoStickerPicker from './ChatInternoStickerPicker';
import ChatInternoStickerMakerModal from './ChatInternoStickerMakerModal';
import ChatInternoImageEditor from './ChatInternoImageEditor';
import data from '@emoji-mart/data/sets/15/apple.json';
import Picker from '@emoji-mart/react';
import {
  renderContentWithAppleEmojis,
  renderAppleEmoji,
  countOnlyEmojis,
  getAppleEmojiUrl,
  extractTextFromContentEditable
} from '../../utils/appleEmojiHelper';
import { getPresenciaInfo } from '../../utils/presenceHelper';
import PasteTableModal from '../Chat/PasteTableModal';
import { isTableClipboardData, processClipboardTable, isTableText, extractTSVForExcel } from '../../utils/excelTableHelper';

// Emojis oficiales de reacción rápida de WhatsApp Desktop (como en la captura del usuario)
const WA_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Paleta de colores distintivos estilo WhatsApp para participantes en grupos
const WA_PALETTE = [
  '#e542a3', // Rosa / Magenta
  '#0284c7', // Azul cielo
  '#059669', // Esmeralda / Verde
  '#d97706', // Ámbar / Naranja oscuro
  '#7c3aed', // Púrpura / Violeta
  '#ea580c', // Naranja
  '#00a884', // Verde azulado WhatsApp
  '#db2777', // Fucsia
  '#2563eb', // Azul real
  '#0d9488', // Teal
];

const getSenderColor = (id, name) => {
  const str = `${name || ''}-${id || ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WA_PALETTE[Math.abs(hash) % WA_PALETTE.length];
};

// Formato de separador de fecha centrado (WhatsApp)
const formatDateDivider = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return 'Hoy';
  }
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  }
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

// Parser de citas / respuestas en texto estilo WhatsApp
const parseQuote = (fullText) => {
  if (!fullText) return { quote: null, cleanText: '' };
  const match = fullText.match(/^>\s*\[?([^\]:\n]+)\]?:\s*([^\n]+)\n\n([\s\S]*)$/);
  if (match) {
    const rawText = match[2].trim();
    return {
      quote: {
        author: match[1].trim(),
        text: rawText,
        isAudio: rawText.includes('🎤') || rawText.toLowerCase().includes('mensaje de voz'),
      },
      cleanText: match[3],
    };
  }
  return { quote: null, cleanText: fullText };
};

// Renderizado con emojis oficiales de Apple/iOS, menciones (@nombre), enlaces destacados y bloques de código
const renderMessageBody = (text) => {
  if (!text) return null;
  const onlyCount = countOnlyEmojis(text);
  if (onlyCount > 0) {
    const size = onlyCount === 1 ? '3.2rem' : '2.2rem';
    return (
      <div className={`wa-emojis-only count-${onlyCount}`}>
        {renderContentWithAppleEmojis(text, size)}
      </div>
    );
  }

  // Si contiene bloques de código multilínea (como tablas de cuadrícula ```)
  if (text.includes('```')) {
    const codeBlocks = text.split(/(```[\s\S]*?```)/g);
    return codeBlocks.map((block, idx) => {
      if (block.startsWith('```') && block.endsWith('```')) {
        const rawCode = block.slice(3, -3);
        const cleanCode = rawCode.replace(/^\n/, '').replace(/\n$/, '');
        return (
          <pre
            key={`wa-code-${idx}`}
            className="wa-code-block"
            style={{
              margin: '4px 0',
              padding: '6px 8px',
              borderRadius: '6px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '12px',
              lineHeight: '1.4',
              overflowX: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              whiteSpace: 'pre',
              tabSize: 8,
              MozTabSize: 8
            }}
          >
            <code>{cleanCode}</code>
          </pre>
        );
      }
      return renderInlineText(block, idx);
    });
  }

  return renderInlineText(text);
};

const renderInlineText = (text, keyPrefix = '') => {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_.-]+(?:\s[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_.-]+)?|@\+?[\d\s()-]+|https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    const k = `${keyPrefix}-${index}`;
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={k}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="wa-msg-url"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith('@')) {
      return (
        <span key={k} className="wa-mention">
          {part}
        </span>
      );
    }
    return <React.Fragment key={k}>{renderContentWithAppleEmojis(part)}</React.Fragment>;
  });
};

/** Botón para copiar tablas o TSV directamente listo para Excel en Chat Interno */
const TableCopyButtonInterno = ({ text }) => {
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
    <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
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
          border: '1px solid #00a884',
          backgroundColor: copied ? '#00a884' : 'rgba(0,168,132,0.18)',
          color: copied ? '#ffffff' : '#25d366',
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

const ChatInternoWindow = ({
  canalActivo,
  mensajes,
  cargandoMensajes,
  escribiendoMap,
  onEnviarTexto,
  onEnviarAdjunto,
  onEnviarSticker,
  onEditarMensaje,
  onToggleFijarMensaje,
  onEliminarMensaje,
  onToggleDestacarMensaje,
  onDeseleccionarCanal,
  onTyping,
  onToggleReaccion,
  onToggleDetalles,
  onToggleFijar,
  detallesOpen,
  userActual,
  contactos = [],
  onAbrirModalCrearCanal,
}) => {
  const [texto, setTexto] = useState('');
  const [adjunto, setAdjunto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [menuDropdownMsgId, setMenuDropdownMsgId] = useState(null);
  const [menuDropdownOpenUp, setMenuDropdownOpenUp] = useState(false);
  const [showExtraEmojis, setShowExtraEmojis] = useState(false);
  const [modalFijarMsg, setModalFijarMsg] = useState(null);
  const [modalInfoMsg, setModalInfoMsg] = useState(null);
  const [duracionFijar, setDuracionFijar] = useState('7d');
  const [mensajeCitado, setMensajeCitado] = useState(null);
  const [mensajeEditando, setMensajeEditando] = useState(null);
  const [textoEditando, setTextoEditando] = useState('');
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [nuevosMensajesCount, setNuevosMensajesCount] = useState(0);
  const prevMensajesCountRef = useRef(mensajes?.length || 0);
  const [busquedaInterna, setBusquedaInterna] = useState('');
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);

  // Estados de Stickers y Menú de Adjuntos
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showStickerMaker, setShowStickerMaker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Estados de Grabación de Audio / Notas de Voz
  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const editInputRef = useRef(null);

  // Auto-focus en el input de edición al abrir el modal
  useEffect(() => {
    if (mensajeEditando) {
      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          const len = editInputRef.current.value.length;
          editInputRef.current.setSelectionRange(len, len);
        }
      }, 60);
    } else {
      setShowEditEmojiPicker(false);
    }
  }, [mensajeEditando]);

  // Forzar scroll al fondo de forma instantánea
  const scrollToBottomImmediate = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    setShowScrollBottom(false);
    setNuevosMensajesCount(0);
  };

  // Callback cuando termina de cargar una imagen o sticker para mantener la vista en el último mensaje
  const handleMediaLoad = () => {
    if (!showScrollBottom && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Auto-scroll y detección de mensajes entrantes mientras la conversación está activa
  useEffect(() => {
    const prevCount = prevMensajesCountRef.current;
    const currentCount = mensajes?.length || 0;
    prevMensajesCountRef.current = currentCount;

    if (currentCount > prevCount && currentCount > 0) {
      const ultimoMsg = mensajes[currentCount - 1];
      const esEntrante = ultimoMsg && Number(ultimoMsg.usuario_id || ultimoMsg.emisor_id) !== Number(userActual?.id);

      const el = messagesContainerRef.current;
      if (el) {
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (esEntrante && !isNearBottom) {
          // El usuario ha scrolleado hacia arriba leyendo el historial: mostrar banner flotante de nuevos mensajes
          setNuevosMensajesCount(prev => prev + (currentCount - prevCount));
        } else {
          // El usuario está al fondo o es un mensaje enviado por él: auto-scroll hacia el nuevo mensaje
          setNuevosMensajesCount(0);
          el.scrollTop = el.scrollHeight;
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } else if (currentCount > 0 && !showScrollBottom) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, escribiendoMap, userActual?.id]);

  // Cerrar menús desplegables al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuDropdownMsgId(null);
      setMenuDropdownOpenUp(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Salir de la conversación o cancelar acciones con tecla Escape (como en WhatsApp)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showEditEmojiPicker) {
          setShowEditEmojiPicker(false);
          return;
        }
        if (mensajeEditando) {
          setMensajeEditando(null);
          setTextoEditando('');
          return;
        }
        if (modalFijarMsg) {
          setModalFijarMsg(null);
          return;
        }
        if (menuDropdownMsgId) {
          setMenuDropdownMsgId(null);
          setMenuDropdownOpenUp(false);
          return;
        }
        if (reactionPickerMsgId) {
          setReactionPickerMsgId(null);
          return;
        }
        if (mensajeCitado) {
          setMensajeCitado(null);
          return;
        }
        if (mostrarBusqueda) {
          setMostrarBusqueda(false);
          setBusquedaInterna('');
          return;
        }
        if (canalActivo && onDeseleccionarCanal) {
          onDeseleccionarCanal();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [modalFijarMsg, menuDropdownMsgId, reactionPickerMsgId, mensajeEditando, showEditEmojiPicker, mensajeCitado, mostrarBusqueda, canalActivo, onDeseleccionarCanal]);

  // 1. Reset al cambiar de canal y forzar scroll inmediato
  useEffect(() => {
    setMensajeCitado(null);
    setMensajeEditando(null);
    setTextoEditando('');
    setShowEditEmojiPicker(false);
    setReactionPickerMsgId(null);
    setMenuDropdownMsgId(null);
    setMenuDropdownOpenUp(false);
    setModalFijarMsg(null);
    setDuracionFijar('7d');
    setShowExtraEmojis(false);
    setBusquedaInterna('');
    setMostrarBusqueda(false);
    setShowScrollBottom(false);
    setNuevosMensajesCount(0);
    prevMensajesCountRef.current = mensajes?.length || 0;
    setTexto('');
    if (textareaRef.current) {
      textareaRef.current.innerHTML = '';
    }

    scrollToBottomImmediate();
  }, [canalActivo?.id]);

  // 2. Al entrar a una conversación o grupo y terminar de cargar: SIEMPRE mostrar el último mensaje
  useEffect(() => {
    if (!cargandoMensajes && canalActivo?.id && mensajes?.length > 0) {
      scrollToBottomImmediate();
      const t1 = setTimeout(scrollToBottomImmediate, 60);
      const t2 = setTimeout(scrollToBottomImmediate, 180);
      const t3 = setTimeout(scrollToBottomImmediate, 400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [cargandoMensajes, canalActivo?.id, mensajes?.length]);

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`wa-msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2200);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isNearBottom);
    if (isNearBottom) {
      setNuevosMensajesCount(0);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    setNuevosMensajesCount(0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditableInput = () => {
    if (!textareaRef.current) return;
    const txt = extractTextFromContentEditable(textareaRef.current);
    setTexto(txt);
    onTyping && onTyping();
  };

  const [tableModalData,  setTableModalData]  = useState(null);
  const [generandoTabla,  setGenerandoTabla]  = useState(false);
  const [editingImageFile, setEditingImageFile] = useState(null);

  const handleEditablePaste = async (e) => {
    // 1. Si se pega un archivo de imagen directo (captura de pantalla)
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            // Si además hay datos de tabla HTML/Excel en el portapapeles, dejar que lo procese el paso 2
            if (isTableClipboardData(e.clipboardData)) {
              break;
            }
            e.preventDefault();
            setEditingImageFile(file);
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
        const isDark = Boolean(document.querySelector('.chat-dark'));
        const res = await processClipboardTable(e.clipboardData, isDark);
        setTableModalData(res);
      } catch (err) {
        console.warn('Error al procesar tabla como imagen, insertando como texto:', err);
        const plain = e.clipboardData?.getData('text/plain') || '';
        if (plain) {
          document.execCommand('insertText', false, plain);
          const txt = extractTextFromContentEditable(textareaRef.current);
          setTexto(txt);
        }
      } finally {
        setGenerandoTabla(false);
      }
      return;
    }

    // 3. Texto plano común
    e.preventDefault();
    const plain = e.clipboardData?.getData('text/plain') || '';
    if (!plain) return;
    document.execCommand('insertText', false, plain);
    const txt = extractTextFromContentEditable(textareaRef.current);
    setTexto(txt);
  };

  const handleSendPastedImage = async (blob, caption) => {
    const file = new File([blob], `tabla_excel_${Date.now()}.png`, { type: 'image/png' });
    if (onEnviarAdjunto) {
      await onEnviarAdjunto(file, caption);
    }
  };

  const handleSendPastedText = async (text) => {
    if (!text || !text.trim() || !onEnviarTexto) return;
    await onEnviarTexto(text.trim());
  };

  const handleSendBoth = async (blob, caption, text) => {
    const file = new File([blob], `tabla_excel_${Date.now()}.png`, { type: 'image/png' });
    if (onEnviarAdjunto) {
      await onEnviarAdjunto(file, caption);
    }
    if (text && text.trim() && onEnviarTexto) {
      setTimeout(async () => {
        await onEnviarTexto(text.trim());
      }, 400);
    }
  };

  const handlePastePastedText = (text) => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand('insertText', false, text);
      const txt = extractTextFromContentEditable(textareaRef.current);
      setTexto(txt);
    } else {
      setTexto(prev => prev + text);
    }
  };

  const handleCloseTableModal = () => {
    if (tableModalData?.url) {
      URL.revokeObjectURL(tableModalData.url);
    }
    setTableModalData(null);
  };

  const handleSelectEmoji = (em) => {
    const emojiChar = typeof em === 'string' ? em : em?.native || '';
    if (!emojiChar) return;

    if (textareaRef.current) {
      textareaRef.current.focus();
      const url = getAppleEmojiUrl(emojiChar);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = emojiChar;
        img.dataset.emoji = emojiChar;
        img.className = 'wa-apple-emoji inline';
        img.draggable = false;

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && textareaRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.setEndAfter(img);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          textareaRef.current.appendChild(img);
        }
      } else {
        document.execCommand('insertText', false, emojiChar);
      }
      const newText = extractTextFromContentEditable(textareaRef.current);
      setTexto(newText);
    } else {
      setTexto(prev => prev + emojiChar);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setEditingImageFile(file);
      } else {
        setAdjunto(file);
      }
    }
  };

  const handleIniciarRespuesta = (msg) => {
    setMensajeCitado(msg);
    textareaRef.current?.focus();
  };

  const handleGuardarEdicionModal = async () => {
    if (!mensajeEditando || !textoEditando.trim() || enviando) return;
    try {
      setEnviando(true);
      if (onEditarMensaje) {
        await onEditarMensaje(mensajeEditando.id, textoEditando.trim());
      }
      setMensajeEditando(null);
      setTextoEditando('');
      setShowEditEmojiPicker(false);
    } catch (err) {
      alert(err.message || 'Error al editar mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const handleSend = async () => {
    if (enviando) return;
    if (!texto.trim() && !adjunto) return;

    setNuevosMensajesCount(0);

    try {
      setEnviando(true);

      let textoFinal = texto.trim();

      if (mensajeCitado) {
        const autor = Number(mensajeCitado.emisor_id) === Number(userActual?.id)
          ? 'Tú'
          : (mensajeCitado.emisor_nombre || 'Usuario');
        let snippet = '';
        if (mensajeCitado.tipo === 'audio' || mensajeCitado.tipo === 'voice') {
          snippet = '🎤 Mensaje de voz';
        } else if (mensajeCitado.tipo === 'imagen') {
          snippet = '📷 Foto';
        } else if (mensajeCitado.tipo === 'sticker') {
          snippet = '💟 Sticker';
        } else if (mensajeCitado.tipo === 'archivo') {
          snippet = `📎 ${mensajeCitado.nombre_adjunto || 'Archivo'}`;
        } else {
          snippet = (mensajeCitado.mensaje || '').replace(/\n/g, ' ').slice(0, 140);
        }
        textoFinal = `> [${autor}]: ${snippet}\n\n${textoFinal}`;
      }

      if (adjunto) {
        await onEnviarAdjunto(adjunto, textoFinal);
        setAdjunto(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await onEnviarTexto(textoFinal);
      }
      setTexto('');
      if (textareaRef.current) {
        textareaRef.current.innerHTML = '';
      }
      setMensajeCitado(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      alert(err.message || 'Error al enviar mensaje');
    } finally {
      setEnviando(false);
    }
  };

  // Función para desactivar y detener el micrófono al 100% de inmediato
  const detenerMicrofonoTotalmente = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        try {
          track.enabled = false;
          track.stop();
        } catch (e) {}
      });
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        try {
          track.enabled = false;
          track.stop();
        } catch (e) {}
      });
    }
  };

  // Limpieza de recursos de audio
  useEffect(() => {
    return () => {
      clearInterval(audioTimerRef.current);
      detenerMicrofonoTotalmente();
    };
  }, []);

  const formatAudioTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const iniciarGrabacionAudio = async () => {
    try {
      if (!navigator.mediaDevices && !navigator.getUserMedia && !navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          alert(
            'El navegador bloquea el uso del micrófono por seguridad porque se está accediendo por HTTP con una dirección IP (' +
            window.location.host +
            ').\n\n' +
            'Soluciones para habilitarlo:\n' +
            '1. Si estás en la misma máquina del servidor, entra por: http://localhost:3003\n' +
            '2. En Chrome/Edge, abre una pestaña en:\n' +
            '   chrome://flags/#unsafely-treat-insecure-origin-as-secure\n' +
            '   Agrega: http://' + window.location.host + '\n' +
            '   Cámbialo a "Enabled" y presiona "Relaunch".'
          );
          return;
        }
        alert('Tu navegador no admite la grabación de audio o no tiene disponible la API de captura.');
        return;
      }

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      let stream = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } else {
        const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        stream = await new Promise((resolve, reject) => {
          legacyGetUserMedia.call(navigator, { audio: audioConstraints }, resolve, reject);
        });
      }

      audioStreamRef.current = stream;

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4'
      ];
      const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';

      const mrOptions = {};
      if (mimeType) mrOptions.mimeType = mimeType;
      mrOptions.audioBitsPerSecond = 128000; // 128 kbps calidad HD de voz

      const mr = new MediaRecorder(stream, mrOptions);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.start(1000); // 1000ms evita micro-cortes y artefactos de audio WebM
      setGrabandoAudio(true);
      setAudioSegundos(0);

      audioTimerRef.current = setInterval(() => {
        setAudioSegundos(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Permiso de micrófono denegado en el navegador. Por favor permite el acceso al micrófono en el icono del candado o configuración del sitio.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert('No se detectó ningún micrófono conectado en este equipo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        alert('El micrófono está ocupado por otra aplicación o pestaña.');
      } else if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        alert(
          'El navegador bloquea el micrófono al conectarse vía IP HTTP (' + window.location.host + ').\n\n' +
          'Soluciones:\n' +
          '1. Entra por: http://localhost:3003 (si estás en el mismo equipo)\n' +
          '2. O habilita en Chrome/Edge:\n' +
          '   chrome://flags/#unsafely-treat-insecure-origin-as-secure\n' +
          '   agregando: http://' + window.location.host
        );
      } else {
        alert('No se pudo acceder al micrófono (' + (err.message || err.name || 'Error al iniciar captura') + ').');
      }
    }
  };

  const cancelarGrabacionAudio = () => {
    clearInterval(audioTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    detenerMicrofonoTotalmente();
    setGrabandoAudio(false);
    setAudioSegundos(0);
    audioChunksRef.current = [];
  };

  const enviarGrabacionAudio = () => {
    clearInterval(audioTimerRef.current);
    const mr = mediaRecorderRef.current;
    if (!mr) {
      detenerMicrofonoTotalmente();
      setGrabandoAudio(false);
      setAudioSegundos(0);
      return;
    }

    const durSec = audioSegundos;
    const durM = Math.floor(durSec / 60);
    const durS = Math.floor(durSec % 60);
    const durFormatted = `${durM}:${String(durS).padStart(2, '0')}`;

    mr.onstop = async () => {
      detenerMicrofonoTotalmente();
      const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
      setGrabandoAudio(false);
      setAudioSegundos(0);
      audioChunksRef.current = [];

      if (blob.size > 0) {
        try {
          const audioFile = new (window.File || File)([blob], `voz_${Date.now()}.webm`, { type: blob.type });
          await onEnviarAdjunto(audioFile, durFormatted, 'audio');
        } catch (err) {
          console.error('Error al enviar nota de voz:', err);
        }
      }
    };

    if (mr.state !== 'inactive') {
      try {
        mr.stop();
      } catch (e) {}
    }
    // Desactivar y detener inmediatamente los tracks de audio al pulsar enviar
    detenerMicrofonoTotalmente();
  };

  if (!canalActivo) {
    return (
      <main className="ci-window wa-window-empty">
        <div className="wa-empty-state-card">
          <div className="wa-empty-icon-circle" style={{ width: 88, height: 88, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
            <img src="/fibri.png" alt="Fibri" style={{ width: 68, height: 68, objectFit: 'contain' }} />
          </div>
          <h2 className="wa-empty-title">Chat Interno Corporativo</h2>
          <p className="wa-empty-subtitle">
            Envía y recibe mensajes con tus compañeros de equipo y canales grupales sin salir de la plataforma.
          </p>

          <div className="wa-empty-actions-row">
            <button
              type="button"
              className="wa-empty-action-btn"
              onClick={() => onAbrirModalCrearCanal && onAbrirModalCrearCanal()}
              title="Crear un nuevo canal grupal"
            >
              <div className="wa-empty-action-circle">
                <Plus size={22} />
              </div>
              <span className="wa-empty-action-label">Crear canal</span>
            </button>

            <button
              type="button"
              className="wa-empty-action-btn"
              onClick={() => {
                const searchInput = document.querySelector('.wa-search-input');
                if (searchInput) {
                  searchInput.focus();
                }
              }}
              title="Buscar un compañero de equipo o chat"
            >
              <div className="wa-empty-action-circle">
                <Search size={20} />
              </div>
              <span className="wa-empty-action-label">Buscar compañero</span>
            </button>
          </div>

          <div className="wa-empty-lock-footer">
            <Lock size={13} />
            <span>Tus conversaciones internas están sincronizadas y protegidas</span>
          </div>
        </div>
      </main>
    );
  }

  const esDirecto = canalActivo.tipo === 'directo';
  const otro = canalActivo.otro_participante;
  const headerTitulo = esDirecto ? (otro?.nombre || 'Chat Directo') : canalActivo.nombre;

  const getPresenciaTexto = (part) => {
    if (!part?.esta_online) return 'desconectado';
    const st = part.estado_presencia || 'disponible';
    switch (st) {
      case 'reunion': return 'En reunión';
      case 'ocupado': return 'No molestar';
      case 'comida':  return 'En comida';
      case 'ausente': return 'Ausente';
      default:        return 'en línea';
    }
  };

  const headerSub = esDirecto
    ? `${getPresenciaTexto(otro)} ${otro?.area ? `• ${otro.area}` : ''}`
    : (canalActivo.miembros_resumen || canalActivo.descripcion || (canalActivo.es_privado ? 'Canal privado' : 'Canal público'));

  const esAdmin = userActual?.rol === 'admin';
  const esCreador = Number(canalActivo.creador_id) === Number(userActual?.id);
  const puedePublicar = !canalActivo.solo_lectura || esAdmin || esCreador;

  const canalTyping = canalActivo
    ? (escribiendoMap[canalActivo.id] || (typeof escribiendoMap === 'object' && !escribiendoMap[canalActivo.id] && Object.values(escribiendoMap).every(v => typeof v === 'string') ? escribiendoMap : {}))
    : {};
  const nombresEscribiendo = Object.values(canalTyping || {});

  // Solamente poder fijar un mensaje: el fijado con fecha y horario más reciente
  const fijadosValidos = mensajes.filter(m => m.fijado && !m.eliminado);
  const ultimoFijado = fijadosValidos.length === 0
    ? null
    : fijadosValidos.length === 1
      ? fijadosValidos[0]
      : fijadosValidos.slice().sort((a, b) => {
          const timeA = a.fijado_en ? new Date(a.fijado_en).getTime() : (a.created_at ? new Date(a.created_at).getTime() : Number(a.id));
          const timeB = b.fijado_en ? new Date(b.fijado_en).getTime() : (b.created_at ? new Date(b.created_at).getTime() : Number(b.id));
          return timeB - timeA; // Más reciente primero
        })[0];

  const mensajesMostrados = busquedaInterna.trim()
    ? mensajes.filter(m => (m.mensaje || '').toLowerCase().includes(busquedaInterna.toLowerCase().trim()))
    : mensajes;

  return (
    <main className="ci-window wa-window">
      {/* Cabecera estilo WhatsApp Desktop */}
      <header className="ci-window-header wa-window-header">
        <div className="ci-header-left wa-header-left" onClick={onToggleDetalles} style={{ cursor: 'pointer' }}>
          {esDirecto ? (
            <div className="wa-header-avatar-wrap">
              {otro?.foto_perfil ? (
                <img src={resolveAvatar(otro.foto_perfil)} alt={otro.nombre} className="wa-header-avatar-img" />
              ) : (
                <div className="wa-header-avatar-placeholder" style={{ background: getSenderColor(otro?.id, otro?.nombre) }}>
                  {otro?.nombre ? otro.nombre.charAt(0).toUpperCase() : <User size={18} />}
                </div>
              )}
              {(() => {
                const pres = getPresenciaInfo(otro);
                return (
                  <div
                    className={`wa-online-dot ${pres.estaOnline ? pres.id : 'offline'}`}
                    style={{
                      backgroundColor: pres.color,
                      boxShadow: `0 0 0 1px ${pres.border}45, 0 1px 3px rgba(0,0,0,0.3)`
                    }}
                    title={`${otro?.nombre || 'Contacto'}: ${pres.labelConEstado}${pres.desc ? ` (${pres.desc})` : ''}`}
                  />
                );
              })()}
            </div>
          ) : (
            canalActivo.foto ? (
              <div className="wa-header-avatar-wrap">
                <img src={resolveAvatar(canalActivo.foto)} alt={canalActivo.nombre} className="wa-header-avatar-img" />
              </div>
            ) : (
              <div className="wa-header-channel-icon publico">
                {canalActivo.es_privado ? <Lock size={20} /> : <Hash size={20} />}
              </div>
            )
          )}

          <div className="wa-header-text-block">
            <div className="wa-header-title">
              <span className="wa-header-title-text">{headerTitulo}</span>
              {canalActivo.fijado && (
                <Pin size={12} color="#8696a0" fill="#8696a0" style={{ transform: 'rotate(45deg)', flexShrink: 0 }} />
              )}
              {canalActivo.solo_lectura && (
                <span className="ci-pill-readonly" title="Solo lectura">
                  <Shield size={10} /> Solo Lectura
                </span>
              )}
            </div>
            <div className="wa-header-desc" title={headerSub}>
              {nombresEscribiendo.length > 0 ? (
                <span style={{ color: '#00a884', fontWeight: 600 }}>
                  {esDirecto
                    ? 'escribiendo...'
                    : (nombresEscribiendo.length === 1
                        ? `${nombresEscribiendo[0]} está escribiendo...`
                        : `${nombresEscribiendo.join(', ')} están escribiendo...`)}
                </span>
              ) : esDirecto ? (() => {
                const pres = getPresenciaInfo(otro);
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      className="ci-header-presence-pill"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        background: `${pres.color}18`,
                        border: `1px solid ${pres.color}45`,
                        color: pres.color,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        lineHeight: '15px'
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pres.color }} />
                      {pres.labelConEstado}
                    </span>
                    {otro?.area && (
                      <span style={{ color: '#8696a0', fontSize: '0.78rem' }}>
                        • {otro.area}
                      </span>
                    )}
                    {pres.mensajePresencia && (
                      <span style={{ fontStyle: 'italic', color: '#8696a0', fontSize: '0.76rem' }}>
                        "{pres.mensajePresencia}"
                      </span>
                    )}
                  </span>
                );
              })() : (
                headerSub
              )}
            </div>
          </div>
        </div>

        <div className="wa-header-actions">
          <button
            type="button"
            className={`ci-btn-icon wa-icon-btn ${mostrarBusqueda ? 'active' : ''}`}
            title="Buscar en el chat"
            onClick={() => {
              setMostrarBusqueda(prev => !prev);
              if (mostrarBusqueda) setBusquedaInterna('');
            }}
          >
            <Search size={18} color={mostrarBusqueda ? '#00a884' : 'currentColor'} />
          </button>

          {onToggleFijar && (
            <button
              type="button"
              className={`ci-btn-icon wa-icon-btn ${canalActivo.fijado ? 'active' : ''}`}
              title={canalActivo.fijado ? 'Desfijar chat' : 'Fijar chat'}
              onClick={() => onToggleFijar(canalActivo.id)}
            >
              <Pin size={18} color={canalActivo.fijado ? '#00a884' : 'currentColor'} fill={canalActivo.fijado ? '#00a884' : 'none'} style={{ transform: 'rotate(45deg)' }} />
            </button>
          )}

          <button
            className={`ci-btn-icon wa-icon-btn ${detallesOpen ? 'active' : ''}`}
            title="Información del contacto o grupo"
            onClick={onToggleDetalles}
          >
            <Info size={19} color={detallesOpen ? '#00a884' : '#54656f'} />
          </button>
        </div>
      </header>

      {/* Barra de búsqueda interna en el chat si está activa */}
      {mostrarBusqueda && (
        <div className="wa-chat-search-bar">
          <div className="wa-chat-search-input-wrap">
            <Search size={16} color="#8696a0" />
            <input
              type="text"
              placeholder="Buscar en esta conversación..."
              value={busquedaInterna}
              onChange={(e) => setBusquedaInterna(e.target.value)}
              autoFocus
            />
            {busquedaInterna && (
              <button className="wa-search-clear-btn" onClick={() => setBusquedaInterna('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <button className="wa-chat-search-close" onClick={() => { setMostrarBusqueda(false); setBusquedaInterna(''); }}>
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de mensaje fijado estilo WhatsApp Desktop */}
      {ultimoFijado && (
        <div className="wa-pinned-bar" onClick={() => scrollToMessage(ultimoFijado.id)}>
          <div className="wa-pinned-bar-icon">
            <Pin size={15} className="wa-pinned-pin-icon" />
          </div>
          <div className="wa-pinned-bar-content">
            <div className="wa-pinned-bar-title">
              <span>Mensaje fijado</span>
              {!esDirecto && ultimoFijado.emisor_nombre && (
                <span className="wa-pinned-bar-author"> • {ultimoFijado.emisor_nombre}</span>
              )}
            </div>
            <div className="wa-pinned-bar-snippet">
              {ultimoFijado.mensaje || (ultimoFijado.tipo === 'imagen' ? '📷 Foto' : '📎 Archivo')}
            </div>
          </div>
          {onToggleFijarMensaje && (
            <button
              type="button"
              className="wa-pinned-bar-unpin-btn"
              title="Desfijar mensaje"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFijarMensaje(ultimoFijado.id);
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* Área de Mensajes con Fondo WhatsApp Doodle Claro */}
      <div
        className="ci-messages-area wa-messages-area"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Aviso de seguridad y sincronización */}
        <div className="wa-encryption-notice-wrap">
          <div className="wa-encryption-notice">
            <Lock size={12} className="wa-notice-lock" />
            <span>Los mensajes en esta sala están sincronizados con el servidor ISP en tiempo real.</span>
          </div>
        </div>

        {cargandoMensajes ? (
          <div className="wa-loading-messages">
            Cargando mensajes...
          </div>
        ) : mensajesMostrados.length === 0 ? (
          <div className="wa-empty-chat-state">
            <p>
              {busquedaInterna
                ? 'No se encontraron mensajes que coincidan con la búsqueda.'
                : 'Aún no hay mensajes en este canal. ¡Sé el primero en escribir!'}
            </p>
          </div>
        ) : (
          mensajesMostrados.map((msg, index) => {
            const isOwn = Number(msg.emisor_id) === Number(userActual?.id);
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const reacciones = Array.isArray(msg.reacciones) ? msg.reacciones : [];

            // Mensaje de sistema
            if (msg.tipo === 'sistema' || (msg.mensaje && msg.mensaje.startsWith('📢'))) {
              return (
                <div key={`msg-${msg.id}`} className="wa-system-message-row">
                  <div className="wa-system-message-pill">
                    <span>{msg.mensaje}</span>
                    <span className="wa-system-time">{timeStr}</span>
                  </div>
                </div>
              );
            }

            // Agrupación por fechas y por remitente consecutivo
            const prevMsg = index > 0 ? mensajesMostrados[index - 1] : null;
            const nextMsg = index < mensajesMostrados.length - 1 ? mensajesMostrados[index + 1] : null;

            const isNewDay = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
            const isSameSenderAsPrev = !isNewDay &&
              prevMsg &&
              Number(prevMsg.emisor_id) === Number(msg.emisor_id) &&
              prevMsg.tipo !== 'sistema' &&
              Math.abs(new Date(msg.created_at) - new Date(prevMsg.created_at)) < 5 * 60 * 1000;

            const isLastFromSender = !nextMsg ||
              Number(nextMsg.emisor_id) !== Number(msg.emisor_id) ||
              nextMsg.tipo === 'sistema' ||
              new Date(msg.created_at).toDateString() !== new Date(nextMsg.created_at).toDateString();

            // Desglose de cita / respuesta
            const { quote, cleanText } = parseQuote(msg.mensaje);
            const senderColor = getSenderColor(msg.emisor_id, msg.emisor_nombre);
            const isMsgPinned = Boolean(ultimoFijado && Number(ultimoFijado.id) === Number(msg.id));

            return (
              <React.Fragment key={`msg-frag-${msg.id}`}>
                {/* Separador de Fecha Centrado estilo WhatsApp */}
                {isNewDay && (
                  <div className="wa-date-divider-wrap">
                    <div className="wa-date-divider-pill">
                      {formatDateDivider(msg.created_at)}
                    </div>
                  </div>
                )}

                <div
                  id={`wa-msg-${msg.id}`}
                  className={`wa-msg-row ${isOwn ? 'own' : 'incoming'} ${!isSameSenderAsPrev ? 'is-first' : 'is-consecutive'} ${isLastFromSender ? 'is-last' : ''} ${highlightedMsgId === msg.id ? 'wa-msg-highlighted' : ''} ${menuDropdownMsgId === msg.id ? 'has-open-menu' : ''}`}
                  onMouseEnter={() => setHoveredMsgId(msg.id)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const spaceBelow = window.innerHeight - e.clientY;
                    setMenuDropdownOpenUp(spaceBelow < 280);
                    setMenuDropdownMsgId(msg.id);
                  }}
                >
                  {/* Columna de Avatar para mensajes entrantes en grupos */}
                  {!isOwn && !esDirecto && (
                    <div className="wa-msg-avatar-col">
                      {!isSameSenderAsPrev ? (
                        msg.emisor_foto ? (
                          <img
                            src={resolveAvatar(msg.emisor_foto)}
                            alt={msg.emisor_nombre}
                            className="wa-msg-avatar-img"
                            title={msg.emisor_nombre}
                          />
                        ) : (
                          <div
                            className="wa-msg-avatar-placeholder"
                            style={{ background: senderColor }}
                            title={msg.emisor_nombre}
                          >
                            {msg.emisor_nombre ? msg.emisor_nombre.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )
                      ) : (
                        <div className="wa-msg-avatar-spacer" />
                      )}
                    </div>
                  )}

                  {/* Componente Trigger de Reacción (Carita Feliz y Píldora Flotante) */}
                  {(() => {
                    const reactionTriggerNode = (
                      <div
                        className={`wa-reaction-trigger-wrap ${isOwn ? 'own' : 'incoming'}`}
                        onMouseLeave={() => {
                          if (!showExtraEmojis && reactionPickerMsgId === msg.id) {
                            setReactionPickerMsgId(null);
                          }
                        }}
                      >
                        {(hoveredMsgId === msg.id || reactionPickerMsgId === msg.id) && (
                          <button
                            type="button"
                            className={`wa-reaction-trigger-btn ${reactionPickerMsgId === msg.id ? 'active' : ''}`}
                            title="Reaccionar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id);
                            }}
                          >
                            <Smile size={18} />
                          </button>
                        )}

                        {/* Píldora Cápsula Flotante de Emojis exactamente como en la captura del usuario */}
                        {reactionPickerMsgId === msg.id && (
                          <div className={`wa-reaction-pill-bar ${isOwn ? 'own' : 'incoming'}`} onClick={(e) => e.stopPropagation()}>
                            {WA_REACTION_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                className="wa-reaction-pill-emoji-btn"
                                onClick={() => {
                                  onToggleReaccion(msg.id, emoji);
                                  setReactionPickerMsgId(null);
                                  setShowExtraEmojis(false);
                                }}
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`wa-reaction-pill-plus-btn ${showExtraEmojis ? 'active' : ''}`}
                              onClick={() => setShowExtraEmojis(prev => !prev)}
                              title="Más reacciones"
                            >
                              <Plus size={16} />
                            </button>

                            {/* Desplegable de más emojis al hacer clic en '+' con Emoji Mart */}
                            {showExtraEmojis && (
                              <div className="wa-reaction-mart-popover" onClick={(e) => e.stopPropagation()}>
                                <Picker
                                  data={data}
                                  set="apple"
                                  onEmojiSelect={(em) => {
                                    onToggleReaccion(msg.id, em.native || em.shortcodes);
                                    setReactionPickerMsgId(null);
                                    setShowExtraEmojis(false);
                                  }}
                                  locale="es"
                                  theme={document.querySelector('.chat-dark') ? 'dark' : 'light'}
                                  previewPosition="none"
                                  skinTonePosition="none"
                                  searchPosition="sticky"
                                  navPosition="top"
                                  perLine={8}
                                  maxFrequentRows={1}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <>
                        {/* En mensajes propios (enviados): Reacción a la IZQUIERDA del globo */}
                        {isOwn && reactionTriggerNode}

                        {/* Globo de Mensaje WhatsApp */}
                        <div className="wa-bubble-wrap">
                          <div className={`ci-msg-bubble wa-bubble ${isOwn ? 'own' : 'incoming'} ${!isSameSenderAsPrev ? 'tail' : 'no-tail'} ${msg.tipo === 'sticker' ? 'is-sticker' : ''} ${(msg.tipo === 'audio' || msg.tipo === 'voice') ? 'is-audio' : ''}`}>
                            {/* Remitente con color distintivo (grupos y primer mensaje del bloque) */}
                            {!isOwn && !isSameSenderAsPrev && !esDirecto && (
                              <div className="wa-sender-header">
                                <span className="wa-msg-sender" style={{ color: senderColor }}>
                                  ~ {msg.emisor_nombre}
                                </span>
                                {msg.emisor_area && (
                                  <span className="wa-msg-sender-sub">{msg.emisor_area}</span>
                                )}
                              </div>
                            )}

                            {/* Tarjeta de Cita / Respuesta estilo WhatsApp */}
                            {quote && (
                              <div
                                className="wa-quote-card"
                                style={{ borderLeftColor: getSenderColor(null, quote.author) }}
                              >
                                <span
                                  className="wa-quote-author"
                                  style={{ color: getSenderColor(null, quote.author) }}
                                >
                                  {quote.author}
                                </span>
                                <div className="wa-quote-snippet">
                                  {quote.isAudio ? (
                                    <div className="wa-quote-audio-snippet">
                                      <Mic size={14} className="wa-quote-mic-icon" />
                                      <span>{quote.text.replace('🎤', '').trim() || 'Mensaje de voz'}</span>
                                    </div>
                                  ) : (
                                    renderContentWithAppleEmojis(quote.text)
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Texto del mensaje */}
                            {cleanText && (
                              <div
                                className={`wa-msg-text${isTableText(cleanText) ? ' has-table' : ''}`}
                                style={isTableText(cleanText) ? { tabSize: 8, MozTabSize: 8, whiteSpace: 'pre-wrap' } : undefined}
                              >
                                {renderMessageBody(cleanText)}
                                {isTableText(cleanText) && <TableCopyButtonInterno text={cleanText} />}
                              </div>
                            )}

                            {/* Nota de voz / Audio estilo WhatsApp */}
                            {(msg.tipo === 'audio' || msg.tipo === 'voice') && msg.url_adjunto && (
                              <ChatInternoAudioPlayer
                                src={msg.url_adjunto.startsWith('http') ? msg.url_adjunto : `${API_URL}${msg.url_adjunto}`}
                                msgId={msg.id}
                                isOwn={isOwn}
                                formatTime={timeStr}
                                ticks={isOwn ? (() => {
                                  const esDirecto = canalActivo?.tipo === 'directo';
                                  const isDestOnline = esDirecto ? Boolean(canalActivo?.otro_participante?.esta_online) : false;
                                  const isLeido = Boolean(msg.leido);
                                  const isEntregado = isLeido || Boolean(msg.entregado) || isDestOnline;

                                  if (isLeido) {
                                    return (
                                      <span className="wa-msg-status-ticks" title={esDirecto ? "Leído" : (msg.total_destinatarios ? `Leído por todos (${msg.total_destinatarios})` : "Leído por todos")}>
                                        <CheckCheck size={15} color="#53bdeb" />
                                      </span>
                                    );
                                  }
                                  if (isEntregado) {
                                    const tooltip = (!esDirecto && msg.leidos_count > 0 && msg.total_destinatarios > 0)
                                      ? `Entregado (Leído por ${msg.leidos_count} de ${msg.total_destinatarios})`
                                      : "Entregado";
                                    return (
                                      <span className="wa-msg-status-ticks" title={tooltip}>
                                        <CheckCheck size={15} color="#8696a0" />
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="wa-msg-status-ticks" title="Enviado">
                                      <Check size={15} color="#8696a0" />
                                    </span>
                                  );
                                })() : null}
                                senderFoto={msg.emisor_foto ? resolveAvatar(msg.emisor_foto) : (isOwn && userActual?.foto_perfil ? resolveAvatar(userActual.foto_perfil) : null)}
                                senderNombre={msg.emisor_nombre || (isOwn ? userActual?.nombre : '')}
                                senderColor={senderColor}
                              />
                            )}

                            {/* Sticker Flotante estilo WhatsApp */}
                            {msg.tipo === 'sticker' && msg.url_adjunto && (
                              <div className="wa-sticker-container">
                                <img
                                  src={resolveMedia(msg.url_adjunto)}
                                  alt="Sticker"
                                  className="wa-sticker-img"
                                  loading="lazy"
                                  onLoad={handleMediaLoad}
                                />
                              </div>
                            )}

                            {/* Adjunto tipo imagen */}
                            {msg.tipo === 'imagen' && msg.url_adjunto && (
                              <img
                                src={`${API_URL}${msg.url_adjunto}`}
                                alt="Adjunto"
                                className="ci-msg-img wa-msg-img"
                                onClick={() => window.open(`${API_URL}${msg.url_adjunto}`, '_blank')}
                                onLoad={handleMediaLoad}
                              />
                            )}

                            {/* Adjunto tipo archivo */}
                            {msg.tipo === 'archivo' && msg.url_adjunto && (
                              <a
                                href={`${API_URL}${msg.url_adjunto}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ci-msg-file-card wa-msg-file-card"
                                download
                              >
                                <FileIcon size={20} className="wa-file-icon" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="wa-file-name">
                                    {msg.nombre_adjunto || 'Archivo'}
                                  </div>
                                  {msg.tamano_adjunto && (
                                    <span className="wa-file-size">
                                      {(msg.tamano_adjunto / 1024).toFixed(1)} KB
                                    </span>
                                  )}
                                </div>
                                <Download size={16} />
                              </a>
                            )}

                            {/* Hora, pin, editado, checks y flecha chevron estilo WhatsApp Web */}
                            <div className={`wa-msg-footer ${(msg.tipo === 'audio' || msg.tipo === 'voice') ? 'wa-msg-footer-audio' : ''}`}>
                              {isMsgPinned && (
                                <span className="wa-msg-pin-indicator" title="Mensaje fijado">
                                  <Pin size={11} fill="#8696a0" color="#8696a0" style={{ transform: 'rotate(45deg)' }} />
                                </span>
                              )}
                              {Boolean(msg.destacado) && (
                                <span className="wa-msg-star-indicator" title="Mensaje destacado" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '3px' }}>
                                  <Star size={11} fill="#8696a0" color="#8696a0" />
                                </span>
                              )}
                              {msg.editado_en && (
                                <span className="wa-msg-edited-tag" title="Mensaje editado">
                                  editado
                                </span>
                              )}
                              {msg.tipo !== 'audio' && msg.tipo !== 'voice' && (
                                <>
                                  <span className="wa-msg-time">{timeStr}</span>
                                  {isOwn && (() => {
                                    const esDirecto = canalActivo?.tipo === 'directo';
                                    const isDestOnline = esDirecto ? Boolean(canalActivo?.otro_participante?.esta_online) : false;
                                    const isLeido = Boolean(msg.leido);
                                    const isEntregado = isLeido || Boolean(msg.entregado) || isDestOnline;

                                    if (isLeido) {
                                      const tooltip = esDirecto
                                        ? "Leído"
                                        : (msg.total_destinatarios ? `Leído por todos (${msg.total_destinatarios})` : "Leído por todos");
                                      return (
                                        <span className="wa-msg-status-ticks" title={tooltip}>
                                          <CheckCheck size={15} color="#53bdeb" />
                                        </span>
                                      );
                                    }
                                    if (isEntregado) {
                                      const tooltip = (!esDirecto && msg.leidos_count > 0 && msg.total_destinatarios > 0)
                                        ? `Entregado (Leído por ${msg.leidos_count} de ${msg.total_destinatarios})`
                                        : "Entregado";
                                      return (
                                        <span className="wa-msg-status-ticks" title={tooltip}>
                                          <CheckCheck size={15} color="#8696a0" />
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="wa-msg-status-ticks" title="Enviado">
                                        <Check size={15} color="#8696a0" />
                                      </span>
                                    );
                                  })()}
                                </>
                              )}
                              <button
                                type="button"
                                className={`wa-msg-chevron-btn ${menuDropdownMsgId === msg.id ? 'active' : ''}`}
                                title="Opciones del mensaje"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (menuDropdownMsgId === msg.id) {
                                    setMenuDropdownMsgId(null);
                                    setMenuDropdownOpenUp(false);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    setMenuDropdownOpenUp(spaceBelow < 280);
                                    setMenuDropdownMsgId(msg.id);
                                  }
                                }}
                              >
                                <ChevronDown size={13} />
                              </button>
                            </div>

                            {/* Menú Desplegable contextual exactamente como en la captura del usuario */}
                            {menuDropdownMsgId === msg.id && (
                              <div
                                className={`wa-msg-dropdown-menu ${isOwn ? 'own' : 'incoming'} ${menuDropdownOpenUp ? 'open-up' : 'open-down'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Barra de Reacciones integrada arriba como en WhatsApp Desktop */}
                                <div className="wa-dropdown-reactions-bar">
                                  {WA_REACTION_EMOJIS.map(emoji => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="wa-dropdown-emoji-btn"
                                      onClick={() => {
                                        onToggleReaccion(msg.id, emoji);
                                        setMenuDropdownMsgId(null);
                                      }}
                                      title={emoji}
                                    >
                                      {renderAppleEmoji(emoji, '1.4rem')}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className="wa-dropdown-emoji-btn plus"
                                    onClick={() => {
                                      setReactionPickerMsgId(msg.id);
                                      setMenuDropdownMsgId(null);
                                    }}
                                    title="Más reacciones"
                                  >
                                    <Plus size={15} />
                                  </button>
                                </div>

                                <div className="wa-dropdown-divider" />

                                {isOwn && !msg.eliminado && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item"
                                    onClick={() => {
                                      setModalInfoMsg(msg);
                                      setMenuDropdownMsgId(null);
                                    }}
                                  >
                                    <Info size={16} />
                                    <span>Info. del mensaje</span>
                                  </button>
                                )}

                                {msg.tipo === 'sticker' && !msg.eliminado && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item"
                                    onClick={async () => {
                                      setMenuDropdownMsgId(null);
                                      const match = msg.url_adjunto?.match(/st:\/\/([^/]+)\/(.+)$/) || msg.url_adjunto?.match(/\/uploads\/stickers\/([^/]+)\/(.+)$/);
                                      if (match) {
                                        try {
                                          await apiService.addStickerFavorito(userActual?.id, match[1], match[2]);
                                          alert('¡Sticker guardado en tus favoritos!');
                                        } catch {
                                          alert('No se pudo guardar el sticker.');
                                        }
                                      } else {
                                        alert('Sticker no disponible para guardar.');
                                      }
                                    }}
                                  >
                                    <Heart size={16} />
                                    <span>Añadir a favoritos</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="wa-dropdown-item"
                                  onClick={() => {
                                    handleIniciarRespuesta(msg);
                                    setMenuDropdownMsgId(null);
                                  }}
                                >
                                  <CornerUpLeft size={16} />
                                  <span>Responder</span>
                                </button>

                                {cleanText && !msg.eliminado && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(cleanText);
                                      setMenuDropdownMsgId(null);
                                    }}
                                  >
                                    <Copy size={16} />
                                    <span>Copiar</span>
                                  </button>
                                )}

                                {onToggleDestacarMensaje && !msg.eliminado && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item"
                                    onClick={async () => {
                                      setMenuDropdownMsgId(null);
                                      try {
                                        await onToggleDestacarMensaje(msg.id);
                                      } catch (err) {
                                        alert(err.message || 'Error al destacar mensaje');
                                      }
                                    }}
                                  >
                                    <Star size={16} fill={msg.destacado ? '#ffb020' : 'none'} color={msg.destacado ? '#ffb020' : 'currentColor'} />
                                    <span>{msg.destacado ? 'No destacar' : 'Destacar'}</span>
                                  </button>
                                )}

                                {onToggleFijarMensaje && !msg.eliminado && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item"
                                    onClick={async () => {
                                      setMenuDropdownMsgId(null);
                                      if (isMsgPinned) {
                                        // Si ya está fijado, desfijar inmediatamente
                                        try {
                                          await onToggleFijarMensaje(msg.id);
                                        } catch (err) {
                                          alert(err.message || 'Error al desfijar mensaje');
                                        }
                                      } else {
                                        // Abrir modal de selección de duración estilo WhatsApp Desktop
                                        setModalFijarMsg(msg);
                                        setDuracionFijar('7d');
                                      }
                                    }}
                                  >
                                    <Pin size={16} />
                                    <span>{isMsgPinned ? 'Desfijar' : 'Fijar'}</span>
                                  </button>
                                )}

                                {isOwn && !msg.eliminado && onEditarMensaje && msg.tipo === 'texto' && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item"
                                    onClick={() => {
                                      setMensajeEditando(msg);
                                      setTextoEditando(cleanText || msg.mensaje || '');
                                      setShowEditEmojiPicker(false);
                                      setMenuDropdownMsgId(null);
                                    }}
                                  >
                                    <Edit3 size={16} />
                                    <span>Editar</span>
                                  </button>
                                )}

                                {((isOwn || esAdmin) && !msg.eliminado && onEliminarMensaje) && (
                                  <button
                                    type="button"
                                    className="wa-dropdown-item danger"
                                    onClick={async () => {
                                      setMenuDropdownMsgId(null);
                                      if (window.confirm('¿Deseas eliminar este mensaje para todos?')) {
                                        try {
                                          await onEliminarMensaje(msg.id);
                                        } catch (err) {
                                          alert(err.message || 'Error al eliminar mensaje');
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 size={16} />
                                    <span>Eliminar</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Píldoras de Reacciones Flotantes superpuestas en el borde del globo */}
                          {reacciones.length > 0 && (
                            <div className="wa-reactions-floating">
                              {reacciones.map(r => (
                                <button
                                  key={r.emoji}
                                  className={`wa-reaction-floating-pill ${r.reacted_by_me ? 'active' : ''}`}
                                  onClick={() => onToggleReaccion(msg.id, r.emoji)}
                                  title={r.agentes ? r.agentes.join(', ') : `${r.count} reacciones`}
                                >
                                  <span>{renderAppleEmoji(r.emoji, '1.15rem')}</span>
                                  {r.count > 1 && <span className="wa-reaction-count">{r.count}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* En mensajes entrantes: Reacción a la DERECHA del globo */}
                        {!isOwn && reactionTriggerNode}
                      </>
                    );
                  })()}
                </div>
              </React.Fragment>
            );
          })
        )}

        {/* Globo animado de escribiendo estilo WhatsApp */}
        {nombresEscribiendo.length > 0 && (
          <div className="wa-msg-row incoming wa-typing-msg-row">
            <div className="wa-msg-bubble incoming wa-typing-bubble">
              {!esDirecto && (
                <span
                  className="wa-msg-sender"
                  style={{
                    color: getSenderColor(null, nombresEscribiendo[0]),
                    marginBottom: 3,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'block'
                  }}
                >
                  {nombresEscribiendo[0]}
                </span>
              )}
              <div className="wa-typing-dots">
                <span className="wa-dot" />
                <span className="wa-dot" />
                <span className="wa-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Botón flotante para bajar al último mensaje cuando se hace scroll */}
      {showScrollBottom && (
        <button
          type="button"
          className="wa-scroll-bottom-btn"
          onClick={scrollToBottom}
          title="Bajar al último mensaje"
        >
          <ChevronDown size={20} />
        </button>
      )}

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

      {/* Barra de Entrada de Texto estilo WhatsApp */}
      {canalActivo.canal_eliminado ? (
        <div className="ci-removed-banner">
          <ShieldAlert size={20} color="#e11d48" style={{ flexShrink: 0 }} />
          <div>
            <strong>Canal Cerrado / Eliminado</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
              Este canal fue cerrado. Todos los participantes conservan el historial anterior.
            </div>
          </div>
        </div>
      ) : canalActivo.soy_miembro_activo === false ? (
        <div className="ci-removed-banner">
          <ShieldAlert size={20} color="#e11d48" style={{ flexShrink: 0 }} />
          <div>
            <strong>Has sido removido de este canal</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
              Ya no puedes publicar ni recibir nuevos mensajes.
            </div>
          </div>
        </div>
      ) : puedePublicar ? (
        <div className="ci-input-bar wa-input-bar">
          {/* Vista previa de respuesta activa */}
          {mensajeCitado && (
            <div
              className="wa-reply-bar"
              style={{
                borderLeftColor: getSenderColor(mensajeCitado.emisor_id, mensajeCitado.emisor_nombre)
              }}
            >
              <div className="wa-reply-bar-info">
                <div
                  className="wa-reply-bar-author"
                  style={{
                    color: getSenderColor(mensajeCitado.emisor_id, mensajeCitado.emisor_nombre)
                  }}
                >
                  Respondiendo a {Number(mensajeCitado.emisor_id) === Number(userActual?.id) ? 'ti mismo' : mensajeCitado.emisor_nombre}
                </div>
                <div className="wa-reply-bar-snippet">
                  {(mensajeCitado.tipo === 'audio' || mensajeCitado.tipo === 'voice') ? (
                    <span className="wa-quote-audio-snippet">
                      <Mic size={14} className="wa-quote-mic-icon" />
                      <span>Mensaje de voz</span>
                    </span>
                  ) : mensajeCitado.tipo === 'imagen' ? (
                    '📷 Foto'
                  ) : mensajeCitado.tipo === 'sticker' ? (
                    '💟 Sticker'
                  ) : mensajeCitado.tipo === 'archivo' ? (
                    `📎 ${mensajeCitado.nombre_adjunto || 'Archivo'}`
                  ) : (
                    mensajeCitado.mensaje
                  )}
                </div>
              </div>
              <button
                type="button"
                className="wa-reply-bar-close"
                onClick={() => setMensajeCitado(null)}
                title="Cancelar respuesta (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Vista previa de adjunto */}
          {adjunto && (
            <div className="ci-preview-attachment wa-preview-attachment">
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

          {grabandoAudio ? (
            <div className="wa-voice-recording-bar">
              <div className="wa-voice-recording-indicator">
                <div className="wa-voice-recording-dot" />
                <span className="wa-voice-recording-timer">{formatAudioTime(audioSegundos)}</span>
              </div>

              <div className="wa-voice-recording-waves">
                <div className="wa-recording-wave-bar" />
                <div className="wa-recording-wave-bar" />
                <div className="wa-recording-wave-bar" />
                <div className="wa-recording-wave-bar" />
                <div className="wa-recording-wave-bar" />
              </div>

              <div className="wa-voice-recording-actions">
                <button
                  type="button"
                  className="wa-voice-cancel-btn"
                  onClick={cancelarGrabacionAudio}
                  title="Cancelar grabación"
                >
                  <Trash2 size={20} />
                </button>

                <button
                  type="button"
                  className="wa-voice-send-btn"
                  onClick={enviarGrabacionAudio}
                  title="Enviar nota de voz"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="wa-input-container">
              {/* Input oculto de archivos */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {/* Botón Emojis & Stickers */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`wa-input-icon-btn ${showStickerPicker ? 'active' : ''}`}
                  title="Emojis y stickers"
                  onClick={() => setShowStickerPicker(prev => !prev)}
                >
                  <Smile size={22} />
                </button>

                {showStickerPicker && (
                  <ChatInternoStickerPicker
                    agenteId={userActual?.id}
                    onSelectEmoji={handleSelectEmoji}
                    onSelectSticker={(pack, file) => {
                      if (onEnviarSticker) {
                        onEnviarSticker(`st://${pack}/${file}`);
                      }
                    }}
                    onOpenMaker={() => setShowStickerMaker(true)}
                    onClose={() => setShowStickerPicker(false)}
                  />
                )}
              </div>

              {/* Botón Adjuntar con Popover */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`wa-input-icon-btn ${showAttachMenu ? 'active' : ''}`}
                  title="Adjuntar"
                  onClick={() => setShowAttachMenu(prev => !prev)}
                >
                  <Paperclip size={21} />
                </button>

                {showAttachMenu && (
                  <div className="wa-attach-popover" onClick={() => setShowAttachMenu(false)}>
                    <button
                      type="button"
                      className="wa-attach-item"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileIcon size={18} color="#7f66ff" />
                      <span>Documento o imagen</span>
                    </button>
                    <button
                      type="button"
                      className="wa-attach-item"
                      onClick={() => setShowStickerMaker(true)}
                    >
                      <Sparkles size={18} color="#00a884" />
                      <span>Nuevo Sticker</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Campo de texto WhatsApp con renderizado de emojis estilo Apple */}
              <div className="wa-textarea-wrapper">
                <div
                  ref={textareaRef}
                  className="wa-textarea wa-textarea-editable"
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  data-placeholder="Escribe un mensaje"
                  onInput={handleEditableInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handleEditablePaste}
                />
              </div>

              {/* Botón de Enviar o Micrófono */}
              {texto.trim() || adjunto ? (
                <button
                  type="button"
                  className="wa-send-btn"
                  disabled={enviando}
                  onClick={handleSend}
                  title="Enviar mensaje"
                >
                  <Send size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="wa-input-icon-btn wa-mic-btn"
                  title="Grabar nota de voz"
                  onClick={iniciarGrabacionAudio}
                >
                  <Mic size={22} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="ci-readonly-banner">
          <Lock size={16} color="#64748b" />
          <span>Este canal es de solo lectura. Solo los administradores pueden publicar comunicados.</span>
        </div>
      )}

      {/* Modal Selección de Duración para Fijar Mensaje estilo WhatsApp Desktop */}
      {modalFijarMsg && (
        <div className="wa-pin-modal-overlay" onClick={() => setModalFijarMsg(null)}>
          <div className="wa-pin-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="wa-pin-modal-title">Selecciona por cuánto tiempo quieres fijar el mensaje</h3>
            <p className="wa-pin-modal-subtitle">Puedes desfijarlo en cualquier momento.</p>

            <div className="wa-pin-modal-options">
              <div
                className={`wa-pin-option-row ${duracionFijar === '24h' ? 'selected' : ''}`}
                onClick={() => setDuracionFijar('24h')}
              >
                <div className="wa-pin-radio-outer">
                  {duracionFijar === '24h' && <div className="wa-pin-radio-inner" />}
                </div>
                <span className="wa-pin-option-label">24 horas</span>
              </div>

              <div
                className={`wa-pin-option-row ${duracionFijar === '7d' ? 'selected' : ''}`}
                onClick={() => setDuracionFijar('7d')}
              >
                <div className="wa-pin-radio-outer">
                  {duracionFijar === '7d' && <div className="wa-pin-radio-inner" />}
                </div>
                <span className="wa-pin-option-label">7 días</span>
              </div>

              <div
                className={`wa-pin-option-row ${duracionFijar === '30d' ? 'selected' : ''}`}
                onClick={() => setDuracionFijar('30d')}
              >
                <div className="wa-pin-radio-outer">
                  {duracionFijar === '30d' && <div className="wa-pin-radio-inner" />}
                </div>
                <span className="wa-pin-option-label">30 días</span>
              </div>
            </div>

            <div className="wa-pin-modal-actions">
              <button
                type="button"
                className="wa-pin-modal-btn cancel"
                onClick={() => setModalFijarMsg(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="wa-pin-modal-btn submit"
                onClick={async () => {
                  const targetMsg = modalFijarMsg;
                  const duracionElegida = duracionFijar;
                  setModalFijarMsg(null);
                  try {
                    await onToggleFijarMensaje(targetMsg.id, duracionElegida);
                  } catch (err) {
                    alert(err.message || 'Error al fijar mensaje');
                  }
                }}
              >
                Fijar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Mensaje estilo WhatsApp Desktop */}
      {mensajeEditando && (
        <div className="wa-edit-modal-overlay" onClick={() => setMensajeEditando(null)}>
          <div className="wa-edit-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Cabecera del modal */}
            <div className="wa-edit-modal-header">
              <button
                type="button"
                className="wa-edit-modal-close-btn"
                onClick={() => setMensajeEditando(null)}
                title="Cerrar (Esc)"
              >
                <X size={20} />
              </button>
              <span className="wa-edit-modal-title">Edita el mensaje</span>
            </div>

            {/* Escenario de previsualización en tiempo real del globo */}
            <div className="wa-edit-modal-preview-stage">
              <div className="wa-bubble-wrap">
                <div className="ci-msg-bubble wa-bubble own tail">
                  <div className="wa-msg-text">
                    {renderContentWithAppleEmojis(textoEditando) || ' '}
                  </div>
                  <div className="wa-msg-footer">
                    <span className="wa-msg-time">
                      {new Date(mensajeEditando.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="wa-msg-status-ticks" title="Leído">
                      <CheckCheck size={15} color="#53bdeb" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de edición con línea verde, selector de emoji y botón check verde */}
            <div className="wa-edit-modal-bottom">
              <div className="wa-edit-input-wrap">
                <input
                  ref={editInputRef}
                  type="text"
                  className="wa-edit-input"
                  value={textoEditando}
                  onChange={(e) => setTextoEditando(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleGuardarEdicionModal();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setMensajeEditando(null);
                    }
                  }}
                  placeholder="Edita el mensaje..."
                />
                <button
                  type="button"
                  className="wa-edit-emoji-trigger"
                  onClick={() => setShowEditEmojiPicker(prev => !prev)}
                  title="Emojis"
                >
                  <Smile size={20} />
                </button>
              </div>

              <button
                type="button"
                className="wa-edit-confirm-btn"
                disabled={!textoEditando.trim() || enviando}
                onClick={handleGuardarEdicionModal}
                title="Guardar cambios (Enter)"
              >
                <Check size={18} />
              </button>
            </div>

            {/* Selector emergente de emojis con Emoji Mart */}
            {showEditEmojiPicker && (
              <div className="wa-edit-emoji-mart-popover" onClick={(e) => e.stopPropagation()}>
                <Picker
                  data={data}
                  set="apple"
                  onEmojiSelect={(em) => {
                    setTextoEditando(prev => prev + (em.native || em.shortcodes));
                    setShowEditEmojiPicker(false);
                    editInputRef.current?.focus();
                  }}
                  locale="es"
                  theme={document.querySelector('.chat-dark') ? 'dark' : 'light'}
                  previewPosition="none"
                  skinTonePosition="none"
                  searchPosition="sticky"
                  navPosition="top"
                  perLine={8}
                  maxFrequentRows={1}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Info del Mensaje estilo WhatsApp Desktop */}
      {modalInfoMsg && (() => {
        const lectoresList = Array.isArray(modalInfoMsg.lectores) ? modalInfoMsg.lectores : [];
        const lectoresIds = new Set(lectoresList.map(l => Number(l.id)));
        const esDirecto = canalActivo?.tipo === 'directo';

        // Destinatarios que no han leído
        const noLectoresList = esDirecto
          ? (canalActivo.otro_participante && !lectoresIds.has(Number(canalActivo.otro_participante.id)) ? [canalActivo.otro_participante] : [])
          : (contactos || []).filter(c => {
              const isNotMe = Number(c.id) !== Number(userActual?.id);
              const isNotLector = !lectoresIds.has(Number(c.id));
              return isNotMe && isNotLector;
            });

        const timeMsg = new Date(modalInfoMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
          <div className="wa-msg-info-modal-overlay" onClick={() => setModalInfoMsg(null)}>
            <div className="wa-msg-info-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="wa-msg-info-header">
                <button
                  type="button"
                  className="wa-msg-info-close-btn"
                  onClick={() => setModalInfoMsg(null)}
                  title="Cerrar"
                >
                  <X size={20} />
                </button>
                <h3 className="wa-msg-info-title">Info. del mensaje</h3>
              </div>

              {/* Previsualización de la burbuja */}
              <div className="wa-msg-info-preview-wrap">
                <div className="wa-bubble own wa-msg-info-bubble">
                  {modalInfoMsg.mensaje && (
                    <div className="wa-msg-text">
                      {renderMessageBody(parseQuote(modalInfoMsg.mensaje).cleanText)}
                    </div>
                  )}
                  <div className="wa-msg-footer">
                    <span className="wa-msg-time">{timeMsg}</span>
                    <span className="wa-msg-status-ticks">
                      {modalInfoMsg.leido ? (
                        <CheckCheck size={15} color="#53bdeb" />
                      ) : (
                        <CheckCheck size={15} color="#8696a0" />
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="wa-msg-info-content-scroll">
                {/* Sección 1: Leído por */}
                <div className="wa-msg-info-section">
                  <div className="wa-msg-info-section-header">
                    <div className="wa-msg-info-section-title-wrap">
                      <CheckCheck size={16} color="#53bdeb" />
                      <span className="wa-msg-info-section-title">
                        Leído por ({lectoresList.length})
                      </span>
                    </div>
                  </div>

                  {lectoresList.length === 0 ? (
                    <div className="wa-msg-info-empty">
                      Nadie ha leído el mensaje todavía.
                    </div>
                  ) : (
                    <div className="wa-msg-info-list">
                      {lectoresList.map(lector => {
                        const readTime = lector.leido_en
                          ? new Date(lector.leido_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '';
                        return (
                          <div key={`lector-${lector.id}`} className="wa-msg-info-item">
                            <div className="wa-msg-info-avatar-wrap">
                              {lector.foto_perfil ? (
                                <img src={resolveAvatar(lector.foto_perfil)} alt={lector.nombre} className="wa-msg-info-avatar-img" />
                              ) : (
                                <div className="wa-msg-info-avatar-placeholder" style={{ background: getSenderColor(lector.id, lector.nombre) }}>
                                  {lector.nombre ? lector.nombre.charAt(0).toUpperCase() : <User size={14} />}
                                </div>
                              )}
                            </div>
                            <div className="wa-msg-info-item-text">
                              <span className="wa-msg-info-name">{lector.nombre}</span>
                              {readTime && (
                                <span className="wa-msg-info-sub">Leído a las {readTime}</span>
                              )}
                            </div>
                            <CheckCheck size={16} color="#53bdeb" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sección 2: Entregado a (restantes) */}
                {!esDirecto && noLectoresList.length > 0 && (
                  <div className="wa-msg-info-section">
                    <div className="wa-msg-info-section-header">
                      <div className="wa-msg-info-section-title-wrap">
                        <CheckCheck size={16} color="#8696a0" />
                        <span className="wa-msg-info-section-title">
                          Entregado a ({noLectoresList.length})
                        </span>
                      </div>
                    </div>

                    <div className="wa-msg-info-list">
                      {noLectoresList.map(noLector => (
                        <div key={`no-lector-${noLector.id}`} className="wa-msg-info-item">
                          <div className="wa-msg-info-avatar-wrap">
                            {noLector.foto_perfil ? (
                              <img src={resolveAvatar(noLector.foto_perfil)} alt={noLector.nombre} className="wa-msg-info-avatar-img" />
                            ) : (
                              <div className="wa-msg-info-avatar-placeholder" style={{ background: getSenderColor(noLector.id, noLector.nombre) }}>
                                {noLector.nombre ? noLector.nombre.charAt(0).toUpperCase() : <User size={14} />}
                              </div>
                            )}
                          </div>
                          <div className="wa-msg-info-item-text">
                            <span className="wa-msg-info-name">{noLector.nombre}</span>
                            <span className="wa-msg-info-sub">{noLector.area || 'Sin leer'}</span>
                          </div>
                          <CheckCheck size={16} color="#8696a0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Creador de Stickers */}
      {showStickerMaker && (
        <ChatInternoStickerMakerModal
          agenteId={userActual?.id}
          onClose={() => setShowStickerMaker(false)}
          onSendSticker={async (blob, stickerUri = null) => {
            if (stickerUri && onEnviarSticker) {
              await onEnviarSticker(stickerUri);
            } else {
              const stickerFile = new (window.File || File)([blob], `sticker_${Date.now()}.webp`, { type: 'image/webp' });
              await onEnviarAdjunto(stickerFile, '', 'sticker');
            }
          }}
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
          isDarkMode={Boolean(document.querySelector('.chat-dark'))}
        />
      )}

      {generandoTabla && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '30px',
          backgroundColor: document.querySelector('.chat-dark') ? '#202c33' : '#ffffff',
          color: document.querySelector('.chat-dark') ? '#e9edef' : '#111b21',
          padding: '10px 18px',
          borderRadius: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          border: document.querySelector('.chat-dark') ? '1px solid #2a3942' : '1px solid #e2e8f0'
        }}>
          <span className="media-spinner" style={{ width: '14px', height: '14px' }} />
          <span>Generando captura de tabla Excel...</span>
        </div>
      )}
      {/* Modal Editor de Imagen estilo WhatsApp al enviar */}
      {editingImageFile && (
        <ChatInternoImageEditor
          file={editingImageFile}
          canal={canalActivo}
          userActual={userActual}
          onClose={() => {
            setEditingImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          onSend={async (blob, caption) => {
            const fileName = editingImageFile.name || `imagen_${Date.now()}.png`;
            const finalFile = new File([blob], fileName, { type: 'image/png' });
            if (onEnviarAdjunto) {
              await onEnviarAdjunto(finalFile, caption);
            }
            setEditingImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}
    </main>
  );
};

export default ChatInternoWindow;
