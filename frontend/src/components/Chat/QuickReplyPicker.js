import React, { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { resolveMedia } from '../../services/api';
import { renderContentWithAppleEmojis } from '../../utils/appleEmojiHelper';

/**
 * Picker flotante que aparece encima del input cuando el agente escribe "/".
 * Filtra en tiempo real por título. Soporta teclado (↑↓ Enter Escape).
 * onSelect(item) recibe el objeto completo de la respuesta rápida.
 */
const QuickReplyPicker = ({ query, items, onSelect, onClose }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  const filtered = query
    ? items.filter(r =>
        r.titulo.toLowerCase().includes(query.toLowerCase()) ||
        (r.contenido || '').toLowerCase().includes(query.toLowerCase())
      )
    : items;

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[activeIdx]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIdx, onSelect, onClose]);

  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (filtered.length === 0) {
    return (
      <div className="qr-picker">
        <div className="qr-picker-header">
          <span className="qr-picker-title">Respuestas rápidas</span>
          <span className="qr-picker-hint">ESC para cerrar</span>
        </div>
        <div className="qr-picker-empty">
          {query ? `Sin resultados para "/${query}"` : 'No tienes respuestas guardadas'}
        </div>
      </div>
    );
  }

  return (
    <div className="qr-picker">
      <div className="qr-picker-header">
        <span className="qr-picker-title">Respuestas rápidas</span>
        <span className="qr-picker-hint">↑↓ para navegar · Enter para {filtered[activeIdx]?.url_media ? 'enviar' : 'insertar'}</span>
      </div>
      <div className="qr-picker-list" ref={listRef}>
        {filtered.map((r, i) => (
          <div
            key={r.id}
            className={`qr-picker-item${i === activeIdx ? ' active' : ''}`}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseDown={(e) => { e.preventDefault(); onSelect(r); }}
          >
            {r.tipo_media === 'image' && r.url_media && (
              <img
                src={resolveMedia(r.url_media)}
                alt=""
                className="qr-picker-thumb"
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
            {r.tipo_media === 'document' && (
              <div className="qr-picker-doc-icon"><FileText size={14} /></div>
            )}
            <div className="qr-picker-text">
              <span className="qr-item-titulo">
                {renderContentWithAppleEmojis(r.titulo)}
                {r.tipo_media && (
                  <span className="qr-media-badge" style={{ marginLeft: 4 }}>
                    {r.tipo_media === 'image' ? '📷' : '📎'}
                  </span>
                )}
              </span>
              {r.contenido && <span className="qr-item-preview">{renderContentWithAppleEmojis(r.contenido)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickReplyPicker;
