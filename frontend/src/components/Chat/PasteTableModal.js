import React, { useState, useEffect, useRef } from 'react';
import { X, Image as ImageIcon, FileText, Check, Layers, Copy } from 'lucide-react';

/**
 * Modal para previsualizar y decidir cómo enviar una tabla copiada desde Excel / Sheets:
 * - Solo Imagen: Captura HD de la tabla con pie de foto opcional
 * - Solo Texto: Envía la tabla como texto plano directamente al chat
 * - Ambos: Envía tanto la imagen como el texto plano
 * - Pegar en chat: Inserta el texto en el cuadro de mensaje sin enviar todavía
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {Blob|null} props.tableBlob
 * @param {string|null} props.imageUrl
 * @param {string} props.tableText
 * @param {string} props.tsvText      - Texto en formato TSV (tabulado con \t para celdas de Excel)
 * @param {string} props.gridText     - Texto en formato cuadrícula visual alineada para WhatsApp
 * @param {string} props.listText     - Texto en formato lista con viñetas
 * @param {number} props.rowCount
 * @param {number} props.colCount
 * @param {Function} props.onSendImage - (blob, caption) => Promise<void>
 * @param {Function} props.onSendText  - (text) => Promise<void>
 * @param {Function} props.onSendBoth  - (blob, caption, text) => Promise<void>
 * @param {Function} props.onPasteText - (text) => void
 * @param {Function} props.onClose     - () => void
 * @param {boolean} props.isDarkMode
 */
const PasteTableModal = ({
  isOpen,
  tableBlob,
  imageUrl,
  tableText = '',
  tsvText = '',
  gridText = '',
  listText = '',
  rowCount = 0,
  colCount = 0,
  onSendImage,
  onSendText,
  onSendBoth,
  onPasteText,
  onClose,
  isDarkMode = false
}) => {
  const [activeTab, setActiveTab] = useState('image'); // 'image' | 'text'
  const [selectedFormat, setSelectedFormat] = useState('tsv'); // 'tsv' | 'grid' | 'list'
  const [caption, setCaption] = useState('');
  const [editableText, setEditableText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingMode, setSendingMode] = useState(null); // 'image' | 'text' | 'both' | null
  const [copiado, setCopiado] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('image');
      setSelectedFormat('tsv');
      setCaption('');
      setEditableText(tsvText || tableText || '');
      setSending(false);
      setSendingMode(null);
      setCopiado(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isOpen, tableText, tsvText]);

  const handleSelectFormat = (fmt) => {
    setSelectedFormat(fmt);
    if (fmt === 'tsv') {
      setEditableText(tsvText || tableText || '');
    } else if (fmt === 'grid') {
      setEditableText(gridText || tableText || '');
    } else if (fmt === 'list') {
      setEditableText(listText || tableText || '');
    }
  };

  // Tecla Escape para cancelar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1. Enviar SOLO la imagen
  const handleSendAsImage = async () => {
    if (!tableBlob || sending) return;
    try {
      setSending(true);
      setSendingMode('image');
      if (onSendImage) {
        await onSendImage(tableBlob, caption.trim());
      }
      onClose();
    } catch (err) {
      console.error('Error al enviar captura de tabla:', err);
    } finally {
      setSending(false);
      setSendingMode(null);
    }
  };

  // 2. Enviar SOLO el texto simple
  const handleSendAsText = async () => {
    const textToSend = (editableText || tableText || '').trim();
    if (!textToSend || sending) return;
    try {
      setSending(true);
      setSendingMode('text');
      if (onSendText) {
        await onSendText(textToSend);
      } else if (onPasteText) {
        onPasteText(textToSend);
      }
      onClose();
    } catch (err) {
      console.error('Error al enviar tabla como texto:', err);
    } finally {
      setSending(false);
      setSendingMode(null);
    }
  };

  // 3. Enviar AMBAS (Imagen + Texto simple)
  const handleSendBoth = async () => {
    if (sending) return;
    const textToSend = (editableText || tableText || '').trim();
    try {
      setSending(true);
      setSendingMode('both');
      if (onSendBoth) {
        await onSendBoth(tableBlob, caption.trim(), textToSend);
      } else {
        if (onSendImage && tableBlob) {
          await onSendImage(tableBlob, caption.trim());
        }
        if (onSendText && textToSend) {
          setTimeout(async () => {
            await onSendText(textToSend);
          }, 400);
        }
      }
      onClose();
    } catch (err) {
      console.error('Error al enviar imagen y texto juntos:', err);
    } finally {
      setSending(false);
      setSendingMode(null);
    }
  };

  // 4. Solo pegar en el cuadro de texto del chat para seguir editando
  const handlePasteAsText = () => {
    if (onPasteText) {
      onPasteText(editableText || tableText);
    }
    onClose();
  };

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(editableText || tableText).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <div
      className="paste-table-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
    >
      <div
        className={`paste-table-card ${isDarkMode ? 'chat-dark' : ''}`}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: isDarkMode ? '#1f2c34' : '#ffffff',
          color: isDarkMode ? '#e9edef' : '#111b21',
          borderRadius: '16px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: isDarkMode ? '1px solid #2a3942' : '1px solid #e2e8f0'
        }}
      >
        {/* Cabecera del modal */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: isDarkMode ? '1px solid #2a3942' : '1px solid #f0f2f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDarkMode ? '#182229' : '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#107c41',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '15px'
              }}
            >
              X
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Tabla de Excel detectada</div>
              <div style={{ fontSize: '11px', color: isDarkMode ? '#8696a0' : '#64748b' }}>
                {rowCount > 0 && `${rowCount} filas`} {colCount > 0 && `• ${colCount} columnas`} • Elige cómo deseas compartirla
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isDarkMode ? '#8696a0' : '#64748b',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de pestañas selectoras */}
        <div
          style={{
            display: 'flex',
            padding: '8px 20px',
            gap: '8px',
            backgroundColor: isDarkMode ? '#111b21' : '#f1f5f9',
            borderBottom: isDarkMode ? '1px solid #222e35' : '1px solid #e2e8f0',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('image')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: activeTab === 'image' ? '#00a884' : 'transparent',
                color: activeTab === 'image' ? '#ffffff' : (isDarkMode ? '#8696a0' : '#64748b')
              }}
            >
              <ImageIcon size={15} />
              <span>Captura de Imagen HD</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('text')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: activeTab === 'text' ? '#00a884' : 'transparent',
                color: activeTab === 'text' ? '#ffffff' : (isDarkMode ? '#8696a0' : '#64748b')
              }}
            >
              <FileText size={15} />
              <span>Texto Simple Editable</span>
            </button>
          </div>

          {activeTab === 'text' && (
            <button
              type="button"
              onClick={handleCopiarTexto}
              style={{
                background: 'none',
                border: isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                color: isDarkMode ? '#8696a0' : '#64748b',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              {copiado ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copiado ? 'Copiado!' : 'Copiar texto'}</span>
            </button>
          )}
        </div>

        {/* Cuerpo del modal según la pestaña */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minHeight: '260px',
            backgroundColor: isDarkMode ? '#111b21' : '#f8fafc'
          }}
        >
          {activeTab === 'image' ? (
            <>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'auto',
                  padding: '12px',
                  backgroundColor: isDarkMode ? '#182229' : '#ffffff',
                  borderRadius: '10px',
                  border: isDarkMode ? '1px solid #222e35' : '1px solid #e2e8f0',
                  maxHeight: '440px'
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Captura de tabla"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div style={{ color: isDarkMode ? '#8696a0' : '#64748b', fontSize: '13px' }}>
                    Generando captura de la tabla...
                  </div>
                )}
              </div>

              {/* Input para comentario / pie de foto */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Añadir un comentario a la captura (opcional)..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendAsImage();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1',
                    backgroundColor: isDarkMode ? '#202c33' : '#ffffff',
                    color: isDarkMode ? '#e9edef' : '#111b21',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
              {/* Selector de formatos estructurados */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? '#8696a0' : '#64748b' }}>
                    Formato:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectFormat('tsv')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: selectedFormat === 'tsv' ? '1px solid #00a884' : (isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1'),
                      backgroundColor: selectedFormat === 'tsv' ? '#00a884' : 'transparent',
                      color: selectedFormat === 'tsv' ? '#ffffff' : (isDarkMode ? '#8696a0' : '#475569'),
                      cursor: 'pointer'
                    }}
                    title="Separado por tabulaciones. Al copiar de WhatsApp y pegar en Excel, se acomoda en celdas separadas."
                  >
                    📋 Celdas Excel (TSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectFormat('grid')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: selectedFormat === 'grid' ? '1px solid #00a884' : (isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1'),
                      backgroundColor: selectedFormat === 'grid' ? '#00a884' : 'transparent',
                      color: selectedFormat === 'grid' ? '#ffffff' : (isDarkMode ? '#8696a0' : '#475569'),
                      cursor: 'pointer'
                    }}
                    title="Cuadrícula fija alineada en bloque de código WhatsApp (```)"
                  >
                    📊 Cuadrícula WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectFormat('list')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: selectedFormat === 'list' ? '1px solid #00a884' : (isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1'),
                      backgroundColor: selectedFormat === 'list' ? '#00a884' : 'transparent',
                      color: selectedFormat === 'list' ? '#ffffff' : (isDarkMode ? '#8696a0' : '#475569'),
                      cursor: 'pointer'
                    }}
                    title="Lista con viñetas y títulos"
                  >
                    📝 Lista
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                  {selectedFormat === 'tsv' && '✓ Optimizado para pegar en celdas de Excel'}
                  {selectedFormat === 'grid' && '✓ Alineación visual con cuadrícula en WhatsApp (```)'}
                  {selectedFormat === 'list' && '✓ Formato lista con viñetas'}
                </div>
              </div>

              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                placeholder="Texto de la tabla..."
                style={{
                  flex: 1,
                  minHeight: '230px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1',
                  backgroundColor: isDarkMode ? '#182229' : '#ffffff',
                  color: isDarkMode ? '#e9edef' : '#111b21',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '12.5px',
                  lineHeight: '1.5',
                  resize: 'none',
                  outline: 'none',
                  whiteSpace: 'pre',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
        </div>

        {/* Barra de acciones inferior con opciones completas */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: isDarkMode ? '1px solid #2a3942' : '1px solid #f0f2f5',
            backgroundColor: isDarkMode ? '#182229' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          {/* Botón secundario para solo pegar en el cuadro del chat sin enviar */}
          <div>
            <button
              type="button"
              onClick={handlePasteAsText}
              disabled={sending}
              style={{
                background: 'none',
                border: isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1',
                color: isDarkMode ? '#8696a0' : '#475569',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: sending ? 'not-allowed' : 'pointer',
                padding: '7px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Inserta el texto en el cuadro de texto del chat para seguir redactando"
            >
              <FileText size={14} />
              <span>Pegar en el chat</span>
            </button>
          </div>

          {/* Opciones de envío directo: Cancelar, Enviar Texto, Enviar Imagen, Enviar Ambos */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: isDarkMode ? '1px solid #2a3942' : '1px solid #cbd5e1',
                backgroundColor: 'transparent',
                color: isDarkMode ? '#d1d7db' : '#475569',
                fontSize: '13px',
                fontWeight: 500,
                cursor: sending ? 'not-allowed' : 'pointer'
              }}
            >
              Cancelar
            </button>

            {/* 1. Opción: Enviar solo Texto */}
            <button
              type="button"
              onClick={handleSendAsText}
              disabled={sending || !(editableText || tableText || '').trim()}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #00a884',
                backgroundColor: 'transparent',
                color: '#00a884',
                fontSize: '13px',
                fontWeight: 600,
                cursor: sending || !(editableText || tableText || '').trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !(editableText || tableText || '').trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Enviar la tabla únicamente como mensaje de texto simple"
            >
              <FileText size={14} />
              <span>{sendingMode === 'text' ? 'Enviando texto...' : 'Enviar Texto'}</span>
            </button>

            {/* 2. Opción: Enviar solo Imagen */}
            <button
              type="button"
              onClick={handleSendAsImage}
              disabled={!tableBlob || sending}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#00a884',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: !tableBlob || sending ? 'not-allowed' : 'pointer',
                opacity: !tableBlob || sending ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Enviar la tabla únicamente como captura de imagen HD"
            >
              <ImageIcon size={14} />
              <span>{sendingMode === 'image' ? 'Enviando imagen...' : 'Enviar Imagen'}</span>
            </button>

            {/* 3. Opción: Enviar Ambos (Imagen + Texto) */}
            <button
              type="button"
              onClick={handleSendBoth}
              disabled={!tableBlob || sending || !(editableText || tableText || '').trim()}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isDarkMode ? '#0284c7' : '#0369a1',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: !tableBlob || sending || !(editableText || tableText || '').trim() ? 'not-allowed' : 'pointer',
                opacity: !tableBlob || sending || !(editableText || tableText || '').trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                transition: 'all 0.15s ease'
              }}
              title="Enviar la captura en imagen Y también el texto simple de la tabla"
            >
              <Layers size={14} />
              <span>{sendingMode === 'both' ? 'Enviando ambos...' : 'Enviar Ambos'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteTableModal;
