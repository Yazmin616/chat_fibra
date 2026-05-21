import React, { useState, useRef } from 'react';
import { Camera, User } from 'lucide-react';
import { apiService, resolveAvatar } from '../../services/api';

const AREAS = ['Ventas', 'Cobranza', 'Soporte Técnico', 'General'];

const AgentForm = ({ agente, onSubmit, onClose }) => {
  const esEdicion = Boolean(agente);

  const [formData, setFormData] = useState({
    nombre:   agente?.nombre   ?? '',
    email:    agente?.email    ?? '',
    password: '',
    rol:      agente?.rol      ?? 'asesor',
    area:     agente?.area     ?? 'Ventas',
  });
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [fotoPreview,  setFotoPreview]  = useState(agente?.foto_perfil ? resolveAvatar(agente.foto_perfil) : null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoInputRef = useRef(null);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setFotoPreview(preview);
    setSubiendoFoto(true);
    try {
      const result = await apiService.subirFotoPerfil(agente.id, file);
      window.dispatchEvent(new CustomEvent('agente:foto-actualizada', {
        detail: { id: agente.id, foto_perfil: result.foto_perfil + '?v=' + Date.now() },
      }));
    } catch (_) {
      setFotoPreview(agente?.foto_perfil ? resolveAvatar(agente.foto_perfil) : null);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err.message || (esEdicion ? 'Error al guardar cambios' : 'Error al crear agente'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="agent-form">
      {error && <div className="agent-form-error">{error}</div>}

      {esEdicion && (
        <div className="agent-photo-upload">
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFotoChange}
          />
          <div
            className={`agent-photo-circle${subiendoFoto ? ' uploading' : ''}`}
            onClick={() => !subiendoFoto && fotoInputRef.current?.click()}
          >
            {fotoPreview
              ? <img src={fotoPreview} alt="avatar" />
              : <User size={32} color="#8696a0" />
            }
            <div className="agent-photo-overlay">
              {subiendoFoto
                ? <span className="agent-photo-spinner" />
                : <Camera size={16} color="#fff" />
              }
            </div>
          </div>
          <span className="agent-photo-label">Foto de perfil</span>
        </div>
      )}

      <div className="form-grid">

        <div className="form-group">
          <label>Nombre Completo</label>
          <input
            type="text" required
            value={formData.nombre}
            onChange={e => set('nombre', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Correo Electrónico</label>
          <input
            type="email" required
            value={formData.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>
            Contraseña
            {esEdicion && <span className="form-label-hint"> — dejar vacío para no cambiar</span>}
          </label>
          <input
            type="password"
            required={!esEdicion}
            minLength={6}
            placeholder={esEdicion ? 'Sin cambios' : ''}
            value={formData.password}
            onChange={e => set('password', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Rol del Sistema</label>
          <select value={formData.rol} onChange={e => set('rol', e.target.value)}>
            <option value="asesor">Asesor (Solo área asignada)</option>
            <option value="admin">Administrador (Acceso total)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Área / Departamento</label>
          <select value={formData.area} onChange={e => set('area', e.target.value)}>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

      </div>

      <div className="agent-form-actions">
        <button type="button" className="btn-cancel" onClick={onClose} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn-save" disabled={submitting}>
          {submitting
            ? (esEdicion ? 'Guardando...' : 'Creando...')
            : (esEdicion ? 'Guardar cambios' : 'Crear cuenta')
          }
        </button>
      </div>
    </form>
  );
};

export default AgentForm;
