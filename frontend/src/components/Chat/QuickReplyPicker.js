import React, { useEffect, useRef, useState } from 'react';

/**
 * Picker flotante que aparece encima del input cuando el agente escribe "/".
 * Filtra en tiempo real por título. Soporta teclado (↑↓ Enter Escape).
 */
const QuickReplyPicker = ({ query, items, onSelect, onClose }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  const filtered = query
    ? items.filter(r =>
        r.titulo.toLowerCase().includes(query.toLowerCase()) ||
        r.contenido.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  // Resetear índice cuando cambia el filtro
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Navegación por teclado
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

  // Hacer scroll al item activo
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
        <span className="qr-picker-hint">↑↓ para navegar · Enter para insertar</span>
      </div>
      <div className="qr-picker-list" ref={listRef}>
        {filtered.map((r, i) => (
          <div
            key={r.id}
            className={`qr-picker-item${i === activeIdx ? ' active' : ''}`}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseDown={(e) => { e.preventDefault(); onSelect(r); }}
          >
            <span className="qr-item-titulo">{r.titulo}</span>
            <span className="qr-item-preview">{r.contenido}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickReplyPicker;
