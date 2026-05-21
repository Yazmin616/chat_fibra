import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { apiService } from '../../services/api';

const EMPTY_FORM = { titulo: '', contenido: '' };

const QuickRepliesModal = ({ items, onClose, onChange }) => {
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [editId,   setEditId]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(false); setError(''); };

  const handleEdit = (item) => {
    setForm({ titulo: item.titulo, contenido: item.contenido });
    setEditId(item.id);
    setShowForm(true);
    setError('');
  };

  const handleGuardar = async () => {
    if (!form.titulo.trim() || !form.contenido.trim()) {
      setError('El título y el contenido son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        const updated = await apiService.actualizarRespuestaRapida(editId, form.titulo.trim(), form.contenido.trim());
        onChange(items.map(r => r.id === editId ? updated : r));
      } else {
        const nueva = await apiService.crearRespuestaRapida(form.titulo.trim(), form.contenido.trim());
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
              <div className="qr-list-item-body">
                <div className="qr-list-titulo">{r.titulo}</div>
                <div className="qr-list-contenido">{r.contenido}</div>
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
                <label className="qr-form-label">Contenido</label>
                <textarea
                  className="qr-form-textarea"
                  placeholder="Texto completo que se insertará en el chat..."
                  value={form.contenido}
                  onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                  maxLength={2000}
                />
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
