import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';

const CerrarChatModal = ({ clienteNombre, onConfirmar, onCancelar, conversacion, user }) => {
  const [categorias,  setCategorias]  = useState([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [comentario,  setComentario]  = useState('');
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState('');
  const overlayRef    = useRef(null);
  const textareaRef   = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const empresaId = conversacion?.empresa_id || 'fibratec';
        const data = await apiService.listarCategoriasCierre(empresaId);
        setCategorias(Array.isArray(data) ? data : []);
      } catch { setCategorias([]); }
    })();
  }, [conversacion]);

  useEffect(() => { if (categoriaId) textareaRef.current?.focus(); }, [categoriaId]);

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
    setError('');
    if (!categoriaId) { setError('Debes seleccionar una categoría de cierre'); return; }
    if (!comentario.trim()) { setError('Debes escribir un comentario explicando la solución'); textareaRef.current?.focus(); return; }
    setCargando(true);
    try { await onConfirmar(Number(categoriaId), comentario.trim()); }
    catch (err) { setError(err.message || 'Error al finalizar'); }
    finally { setCargando(false); }
  };

  const catSel = categorias.find(c => c.id === Number(categoriaId));

  return (
    <div className="cc-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="cc-modal">
        <div className="cc-header">
          <div className="cc-header-icon"><CheckCircle size={20} color="#22c55e" /></div>
          <div>
            <h2 className="cc-title">Finalizar conversación</h2>
            {clienteNombre && <p className="cc-subtitle">con {clienteNombre}</p>}
          </div>
          <button className="cc-close" onClick={onCancelar} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form className="cc-body" onSubmit={handleSubmit}>
          <div className="cc-field">
            <label className="cc-label">Categoría de cierre <span className="cc-label-required">*</span></label>
            <select className="cc-select" value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required>
              <option value="">-- Seleccionar categoría --</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}{cat.area ? ` (${cat.area})` : ''}
                </option>
              ))}
            </select>
            {catSel?.descripcion && <p className="cc-field-hint">{catSel.descripcion}</p>}
          </div>

          <div className="cc-field">
            <label className="cc-label">Solución proporcionada <span className="cc-label-required">*</span></label>
            <textarea
              ref={textareaRef}
              className="cc-textarea"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Describe qué solución se dio al cliente, en tus propias palabras..."
              maxLength={2000}
              rows={4}
              required
            />
            <span className="cc-char-count">{comentario.length}/2000</span>
          </div>

          {error && <div className="cc-error"><AlertCircle size={14} /> {error}</div>}

          <div className="cc-actions">
            <button type="button" className="cc-btn-cancel" onClick={onCancelar} disabled={cargando}>Cancelar</button>
            <button type="submit" className="cc-btn-confirm" disabled={cargando || !categoriaId || !comentario.trim()}>
              {cargando ? 'Finalizando…' : 'Finalizar conversación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CerrarChatModal;