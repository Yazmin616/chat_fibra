import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle } from 'lucide-react';

const CerrarChatModal = ({ clienteNombre, onConfirmar, onCancelar }) => {
  const [motivo,   setMotivo]   = useState('cliente solucionado');
  const [solucion, setSolucion] = useState('');
  const [cargando, setCargando] = useState(false);
  const overlayRef = useRef(null);
  const textareaRef = useRef(null);

  // Foco en el textarea al abrir
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Cerrar con Escape
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onCancelar]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onCancelar();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) return;
    setCargando(true);
    await onConfirmar(motivo.trim(), solucion.trim());
    setCargando(false);
  };

  return (
    <div className="cc-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="cc-modal">
        <div className="cc-header">
          <div className="cc-header-icon">
            <CheckCircle size={20} color="#22c55e" />
          </div>
          <div>
            <h2 className="cc-title">Finalizar conversación</h2>
            {clienteNombre && (
              <p className="cc-subtitle">con {clienteNombre}</p>
            )}
          </div>
          <button className="cc-close" onClick={onCancelar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form className="cc-body" onSubmit={handleSubmit}>
          <div className="cc-field">
            <label className="cc-label">Motivo del cierre</label>
            <input
              className="cc-input"
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej. cliente solucionado"
              maxLength={200}
              required
            />
          </div>

          <div className="cc-field">
            <label className="cc-label">
              Solución proporcionada
              <span className="cc-label-opt"> (opcional)</span>
            </label>
            <textarea
              ref={textareaRef}
              className="cc-textarea"
              value={solucion}
              onChange={e => setSolucion(e.target.value)}
              placeholder="Describe brevemente qué se hizo para resolver el problema del cliente..."
              maxLength={1000}
              rows={4}
            />
            <span className="cc-char-count">{solucion.length}/1000</span>
          </div>

          <div className="cc-actions">
            <button type="button" className="cc-btn-cancel" onClick={onCancelar} disabled={cargando}>
              Cancelar
            </button>
            <button type="submit" className="cc-btn-confirm" disabled={cargando || !motivo.trim()}>
              {cargando ? 'Finalizando…' : 'Finalizar conversación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CerrarChatModal;
