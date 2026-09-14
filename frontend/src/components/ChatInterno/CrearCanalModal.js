import React, { useState } from 'react';
import { X, Lock, Shield, Crown, UserCheck } from 'lucide-react';

const CrearCanalModal = ({ contactos = [], onCrear, onClose }) => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [esPrivado, setEsPrivado] = useState(false);
  const [soloLectura, setSoloLectura] = useState(false);
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState([]);
  const [adminsSeleccionados, setAdminsSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const toggleMiembro = (id) => {
    setMiembrosSeleccionados(prev => {
      const exists = prev.includes(id);
      if (exists) {
        // Si se deselecciona como miembro, también se quita de admins
        setAdminsSeleccionados(aPrev => aPrev.filter(aId => aId !== id));
        return prev.filter(mId => mId !== id);
      }
      return [...prev, id];
    });
  };

  const toggleAdmin = (e, id) => {
    e.stopPropagation();
    // Si no estaba en miembros, lo agregamos automáticamente
    if (!miembrosSeleccionados.includes(id)) {
      setMiembrosSeleccionados(prev => [...prev, id]);
    }
    setAdminsSeleccionados(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
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
        adminIds: adminsSeleccionados,
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
      <div className="ci-modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
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

            {/* Aviso informativo de Creador/Anfitrión */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#334155'
            }}>
              <Crown size={18} color="#d97706" style={{ flexShrink: 0 }} />
              <span>
                <strong>Tú serás el Administrador Anfitrión.</strong> Tendrás control total y ningún otro administrador podrá sacarte del grupo.
              </span>
            </div>

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

            {/* Sección de Miembros y Asignación de Administradores */}
            <div className="ci-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>
                  {esPrivado ? 'Seleccionar miembros y administradores' : 'Designar administradores adicionales (Opcional)'}
                </label>
                {adminsSeleccionados.length > 0 && (
                  <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    {adminsSeleccionados.length} Admin{adminsSeleccionados.length > 1 ? 's' : ''} adicional{adminsSeleccionados.length > 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', padding: '6px' }}>
                {contactos.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No hay colaboradores disponibles
                  </div>
                ) : (
                  contactos.map((c) => {
                    const isSelected = esPrivado ? miembrosSeleccionados.includes(c.id) : true;
                    const isAdmin = adminsSeleccionados.includes(c.id);

                    return (
                      <div
                        key={c.id}
                        onClick={() => esPrivado ? toggleMiembro(c.id) : toggleAdmin({ stopPropagation: () => {} }, c.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          marginBottom: '3px',
                          background: isAdmin ? '#eff6ff' : (isSelected && esPrivado ? '#f8fafc' : 'transparent'),
                          border: isAdmin ? '1px solid #bfdbfe' : '1px solid transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          {esPrivado && (
                            <input
                              type="checkbox"
                              checked={miembrosSeleccionados.includes(c.id)}
                              onChange={() => {}}
                              style={{ pointerEvents: 'none' }}
                            />
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: isAdmin ? 600 : 500, color: isAdmin ? '#1e40af' : '#1e293b' }}>
                              {c.nombre}
                            </span>
                            <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                              {c.area || c.rol}
                            </span>
                          </div>
                        </div>

                        {/* Botón para Alternar Rol de Administrador */}
                        {(isSelected || !esPrivado) && (
                          <button
                            type="button"
                            onClick={(e) => toggleAdmin(e, c.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: 'none',
                              transition: 'all 0.15s ease',
                              background: isAdmin ? '#2563eb' : '#f1f5f9',
                              color: isAdmin ? '#ffffff' : '#64748b'
                            }}
                            title={isAdmin ? 'Quitar rol de Administrador' : 'Nombrar Administrador'}
                          >
                            <Shield size={13} />
                            <span>{isAdmin ? '🛡️ Admin' : '+ Hacer Admin'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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
