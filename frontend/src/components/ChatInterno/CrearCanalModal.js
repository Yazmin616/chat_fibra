import React, { useState } from 'react';
import { X, Lock, Shield } from 'lucide-react';

const CrearCanalModal = ({ contactos, onCrear, onClose }) => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [esPrivado, setEsPrivado] = useState(false);
  const [soloLectura, setSoloLectura] = useState(false);
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const toggleMiembro = (id) => {
    setMiembrosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Por favor escribe un nombre para el canal');
      return;
    }

    try {
      setGuardando(true);
      setError('');
      await onCrear({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        esPrivado,
        soloLectura,
        miembroIds: esPrivado ? miembrosSeleccionados : [],
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear el canal');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="ci-modal-backdrop" onClick={onClose}>
      <div className="ci-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ci-modal-header">
          <h3>Crear Nuevo Canal Corporativo</h3>
          <button className="ci-btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ci-modal-body">
            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', background: '#fee2e2', padding: '8px 12px', borderRadius: '6px' }}>
                {error}
              </div>
            )}

            <div className="ci-form-group">
              <label>Nombre del canal</label>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontWeight: 'bold' }}>#</span>
                <input
                  type="text"
                  placeholder="ej. avisos-direccion o soporte-guardias"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  style={{ paddingLeft: '28px', width: '100%' }}
                  required
                />
              </div>
            </div>

            <div className="ci-form-group">
              <label>Descripción / Objetivo del Canal</label>
              <textarea
                rows={2}
                placeholder="¿De qué trata este canal y quiénes participan?"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {/* Opciones de Permisos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="soloLectura"
                  checked={soloLectura}
                  onChange={(e) => setSoloLectura(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="soloLectura" style={{ cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={15} color={soloLectura ? '#2563eb' : '#64748b'} />
                  <span><strong>Canal de Difusión / Solo Lectura</strong> (Solo creador y admins pueden publicar)</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="esPrivado"
                  checked={esPrivado}
                  onChange={(e) => setEsPrivado(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="esPrivado" style={{ cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} color={esPrivado ? '#ef4444' : '#64748b'} />
                  <span><strong>Canal Privado</strong> (Solo miembros seleccionados podrán verlo)</span>
                </label>
              </div>
            </div>

            {esPrivado && (
              <div className="ci-form-group">
                <label>Seleccionar miembros iniciales</label>
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', padding: '6px' }}>
                  {contactos.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => toggleMiembro(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: miembrosSeleccionados.includes(c.id) ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={miembrosSeleccionados.includes(c.id)}
                        onChange={() => {}}
                        style={{ pointerEvents: 'none' }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.nombre}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({c.area || c.rol})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ci-modal-footer">
            <button type="button" className="ci-btn-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="ci-btn-primary" disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear Canal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CrearCanalModal;
