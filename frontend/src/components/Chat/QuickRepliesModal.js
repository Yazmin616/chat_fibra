import React, { useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Zap, Paperclip, XCircle, FileText } from 'lucide-react';
import { apiService, resolveMedia } from '../../services/api';

const EMPTY_FORM = { titulo: '', contenido: '', mediaFile: null, mediaPreview: null, removeMedia: false };

const QuickRepliesModal = ({ items, onClose, onChange }) => {
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [editId,   setEditId]   = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const fileRef = useRef(null);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setEditItem(null);
    setShowForm(false);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleEdit = (item) => {
    setForm({ titulo: item.titulo, contenido: item.contenido || '', mediaFile: null, mediaPreview: null, removeMedia: false });
    setEditId(item.id);
    setEditItem(item);
    setShowForm(true);
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setForm(f => ({ ...f, mediaFile: file, mediaPreview: previewUrl, removeMedia: false }));
  };

  const handleRemoveMedia = () => {
    setForm(f => ({ ...f, mediaFile: null, mediaPreview: null, removeMedia: true }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleGuardar = async () => {
    if (!form.titulo.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (!form.contenido.trim() && !form.mediaFile && !editItem?.url_media && form.removeMedia) {
      setError('Se requiere texto o un archivo adjunto.');
      return;
    }
    if (!form.contenido.trim() && !form.mediaFile && !editItem?.url_media) {
      setError('Se requiere texto o un archivo adjunto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        const updated = await apiService.actualizarRespuestaRapida(
          editId, form.titulo.trim(), form.contenido.trim(),
          form.mediaFile || null, form.removeMedia
        );
        onChange(items.map(r => r.id === editId ? updated : r));
      } else {
        const nueva = await apiService.crearRespuestaRapida(
          form.titulo.trim(), form.contenido.trim(), form.mediaFile || null
        );
        onChange([...items, nueva].sort((a, b) => a.titulo.localeCompare(b.titulo)));
      }
      resetForm();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta respuesta rápida?')) return;
    try {
      await apiService.eliminarRespuestaRapida(id);
      onChange(items.filter(r => r.id !== id));
      if (editId === id) resetForm();
    } catch (e) {
      setError(e.message || 'Error al eliminar');
    }
  };

  // Determinar qué media mostrar en el formulario
  const mediaPreviewUrl = form.mediaPreview
    ? form.mediaPreview
    : (!form.removeMedia && editItem?.url_media && editItem?.tipo_media === 'image')
      ? resolveMedia(editItem.url_media)
      : null;

  const hasExistingDoc = !form.removeMedia && !form.mediaFile && editItem?.tipo_media === 'document';

  return (
    <div className="qr-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qr-modal">

        <div className="qr-modal-header">
          <h3><Zap size={17} color="#DC1E1E" /> Respuestas rápidas</h3>
          <button className="qr-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="qr-modal-body">

          {items.length === 0 && !showForm && (
            <div className="qr-empty">
              <div className="qr-empty-icon">⚡</div>
              <div className="qr-empty-title">Aún no tienes respuestas rápidas</div>
              <div className="qr-empty-text">
                Crea atajos para mensajes que usas frecuentemente.<br />
                Escribe <strong>/</strong> en el chat para usarlas.
              </div>
            </div>
          )}

          {items.map(r => (
            <div key={r.id} className="qr-list-item">
              {r.tipo_media === 'image' && r.url_media && (
                <img
                  src={resolveMedia(r.url_media)}
                  alt=""
                  className="qr-list-thumb"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              {r.tipo_media === 'document' && (
                <div className="qr-list-doc-icon"><FileText size={18} /></div>
              )}
              <div className="qr-list-item-body">
                <div className="qr-list-titulo">
                  {r.titulo}
                  {r.tipo_media && (
                    <span className="qr-media-badge">{r.tipo_media === 'image' ? '📷' : '📎'}</span>
                  )}
                </div>
                {r.contenido && <div className="qr-list-contenido">{r.contenido}</div>}
              </div>
              <div className="qr-list-actions">
                <button className="qr-icon-btn" onClick={() => handleEdit(r)} title="Editar">
                  <Pencil size={14} />
                </button>
                <button className="qr-icon-btn delete" onClick={() => handleEliminar(r.id)} title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {showForm ? (
            <div className={`qr-form${editId ? ' editing' : ''}`}>
              <div>
                <label className="qr-form-label">Título (atajo)</label>
                <input
                  className="qr-form-input"
                  placeholder="ej: saludo, tarjeta, horario..."
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  maxLength={100}
                  autoFocus
                />
                <div className="qr-form-hint">Se activa escribiendo /{form.titulo || 'atajo'} en el chat</div>
              </div>

              <div>
                <label className="qr-form-label">Texto / Caption <span style={{ color: '#888', fontWeight: 400 }}>(opcional si hay adjunto)</span></label>
                <textarea
                  className="qr-form-textarea"
                  placeholder="Texto o caption del archivo..."
                  value={form.contenido}
                  onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                  maxLength={2000}
                />
              </div>

              {/* Adjunto de media */}
              <div>
                <label className="qr-form-label">Imagen o documento adjunto <span style={{ color: '#888', fontWeight: 400 }}>(opcional)</span></label>

                {mediaPreviewUrl && (
                  <div className="qr-media-preview">
                    <img src={mediaPreviewUrl} alt="preview" className="qr-media-preview-img" />
                    <button className="qr-media-remove" onClick={handleRemoveMedia} title="Quitar imagen">
                      <XCircle size={16} />
                    </button>
                  </div>
                )}

                {hasExistingDoc && (
                  <div className="qr-media-doc-existing">
                    <FileText size={14} />
                    <span>{editItem.nombre_archivo || 'Documento adjunto'}</span>
                    <button className="qr-icon-btn delete" onClick={handleRemoveMedia} title="Quitar adjunto">
                      <XCircle size={13} />
                    </button>
                  </div>
                )}

                {!mediaPreviewUrl && !hasExistingDoc && (
                  <button className="qr-attach-btn" type="button" onClick={() => fileRef.current?.click()}>
                    <Paperclip size={14} /> Adjuntar imagen o PDF
                  </button>
                )}
                {(mediaPreviewUrl || hasExistingDoc) && (
                  <button className="qr-attach-btn" type="button" onClick={() => fileRef.current?.click()}>
                    <Paperclip size={14} /> Cambiar archivo
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="qr-form-hint">JPG, PNG, GIF, WebP o PDF · máx. 8 MB</div>
              </div>

              {error && <div style={{ fontSize: 12, color: '#DC1E1E' }}>{error}</div>}
              <div className="qr-form-actions">
                <button className="qr-btn qr-btn-ghost" onClick={resetForm} disabled={saving}>
                  Cancelar
                </button>
                <button className="qr-btn qr-btn-primary" onClick={handleGuardar} disabled={saving}>
                  {saving ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Agregar')}
                </button>
              </div>
            </div>
          ) : (
            <button className="qr-add-btn" onClick={() => { setShowForm(true); setError(''); }}>
              <Plus size={16} /> Nueva respuesta rápida
            </button>
          )}

          {error && !showForm && (
            <div style={{ fontSize: 12, color: '#DC1E1E', padding: '4px 0' }}>{error}</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default QuickRepliesModal;
