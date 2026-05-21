import React, { useState } from 'react';

const AREAS = ['Ventas', 'Cobranza', 'Soporte Técnico', 'General'];

/**
 * Formulario compartido para crear y editar agentes.
 *
 * Modo creación : no pasa prop `agente` → password obligatorio.
 * Modo edición  : recibe `agente` con datos actuales → password opcional,
 *                 el modal wrapeador muestra el overlay.
 *
 * @param {object}   props
 * @param {object}   [props.agente]   - Agente a editar (undefined = crear).
 * @param {Function} props.onSubmit   - async (formData) => void
 * @param {Function} props.onClose    - Cierra el formulario.
 */
const AgentForm = ({ agente, onSubmit, onClose }) => {
  const esEdicion = Boolean(agente);

  const [formData, setFormData] = useState({
    nombre:   agente?.nombre   ?? '',
    email:    agente?.email    ?? '',
    password: '',
    rol:      agente?.rol      ?? 'asesor',
    area:     agente?.area     ?? 'Ventas',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

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
      {error && (
        <div className="agent-form-error">{error}</div>
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
