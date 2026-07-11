import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { apiService } from '../../../services/api';
import { EMPRESAS_DEF } from '../../../hooks/usePermisos';

const AreasSolucionesSection = ({ empresaId, user }) => {
  const [areas, setAreas] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre_area: '', descripcion: '', soluciones: [] });
  const [nuevaSolucion, setNuevaSolucion] = useState('');

  const loadAreas = async () => {
    try {
      setLoading(true);
      const [data, fetchedAvailableAreas] = await Promise.all([
        apiService.getAreasSoluciones(empresaId),
        apiService.getAreas(empresaId)
      ]);
      setAreas(data);
      setAvailableAreas(fetchedAvailableAreas);
    } catch (error) {
      alert('Error cargando áreas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
    // eslint-disable-next-line
  }, [empresaId]);

  const handleEdit = (area) => {
    setEditingId(area.id);
    setEditForm({
      nombre_area: area.nombre_area,
      descripcion: area.descripcion || '',
      soluciones: area.soluciones || []
    });
    setNuevaSolucion('');
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = async (id) => {
    try {
      await apiService.updateAreaSolucion(id, editForm);
      setEditingId(null);
      loadAreas();
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleCreate = async () => {
    try {
      const defaultName = availableAreas.length > 0 ? availableAreas[0] : 'Nueva Área';
      const nuevaArea = {
        empresa_id: empresaId, // Will send 'todas' to backend if global view is selected
        nombre_area: defaultName,
        descripcion: 'Descripción del área',
        soluciones: []
      };
      await apiService.createAreaSolucion(nuevaArea);
      loadAreas();
    } catch (error) {
      alert('Error al crear área: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta área y sus soluciones?')) return;
    try {
      await apiService.deleteAreaSolucion(id);
      loadAreas();
    } catch (error) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const addSolucion = () => {
    if (!nuevaSolucion.trim()) return;
    setEditForm(prev => ({
      ...prev,
      soluciones: [...prev.soluciones, nuevaSolucion.trim()]
    }));
    setNuevaSolucion('');
  };

  const removeSolucion = (index) => {
    setEditForm(prev => ({
      ...prev,
      soluciones: prev.soluciones.filter((_, i) => i !== index)
    }));
  };

  if (loading) return <div className="cfg-section-wrap">Cargando áreas...</div>;

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><Layers size={20} /></span> Áreas y Soluciones del Bot</h2>
        <p>Define las áreas de atención de la empresa y los puntos clave que cada una puede solucionar.</p>
        
        {user?.rol === 'admin' && (
          <button className="btn-save" onClick={handleCreate} style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Agregar Nueva Área {empresaId === 'todas' ? '(Global)' : ''}
          </button>
        )}
      </div>

      <div className="areas-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {areas.map(area => {
          const isEditing = editingId === area.id;
          
          let eArr = Array.isArray(area.empresa_id) ? area.empresa_id : [area.empresa_id || 'todas'];
          const isGlobal = eArr.includes('todas');
          let labelText = '';
          if (isGlobal) {
            labelText = ' (Global)';
          } else if (empresaId === 'todas') {
            labelText = ` (${eArr.join(', ')})`;
          }
          const labelEmpresa = labelText;

          if (isEditing) {
            const editArr = Array.isArray(editForm.empresa_id) ? editForm.empresa_id : [editForm.empresa_id || 'todas'];
            const isEditGlobal = editArr.includes('todas');

            return (
              <div key={area.id} className="settings-card sc-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Nombre del Área</label>
                    <select
                      className="cfg-input"
                      value={editForm.nombre_area}
                      onChange={e => setEditForm({ ...editForm, nombre_area: e.target.value })}
                    >
                      {availableAreas.length === 0 && <option value={editForm.nombre_area}>{editForm.nombre_area}</option>}
                      {availableAreas.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Descripción</label>
                    <input
                      type="text"
                      className="cfg-input"
                      value={editForm.descripcion}
                      onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Pertenece a la Empresa</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <label style={{ 
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '6px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '20px',
                          cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none',
                          border: `1px solid ${isEditGlobal ? '#10b981' : '#cbd5e1'}`,
                          backgroundColor: isEditGlobal ? '#ecfdf5' : '#f8fafc',
                          color: isEditGlobal ? '#047857' : '#64748b',
                          boxShadow: isEditGlobal ? '0 2px 4px rgba(16, 185, 129, 0.1)' : 'none'
                        }}>
                        <input 
                          type="checkbox" 
                          style={{ display: 'none' }}
                          checked={isEditGlobal}
                          onChange={() => setEditForm({ ...editForm, empresa_id: ['todas'] })}
                        />
                        Global (Todas)
                      </label>
                      {EMPRESAS_DEF.map(emp => {
                        const isSelected = editArr.includes(emp.id);
                        return (
                          <label key={emp.id} style={{ 
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: '6px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '20px',
                            cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none',
                            border: `1px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                            backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                            color: isSelected ? '#1d4ed8' : '#64748b',
                            boxShadow: isSelected ? '0 2px 4px rgba(59, 130, 246, 0.1)' : 'none',
                            opacity: isEditGlobal ? 0.5 : 1
                          }}>
                            <input 
                              type="checkbox" 
                              style={{ display: 'none' }}
                              checked={isSelected}
                              disabled={isEditGlobal}
                              onChange={(e) => {
                                let current = [...editArr].filter(id => id !== 'todas');
                                if (e.target.checked) {
                                  current.push(emp.id);
                                } else {
                                  current = current.filter(id => id !== emp.id);
                                }
                                if (current.length === 0) current = ['todas'];
                                setEditForm({ ...editForm, empresa_id: current });
                              }}
                            />
                            {emp.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Soluciones / Puntos Clave</label>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editForm.soluciones.map((sol, index) => (
                      <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        <span style={{ flex: 1, fontSize: '14px' }}>• {sol}</span>
                        <button className="th-btn-icon th-btn-delete" onClick={() => removeSolucion(index)} title="Eliminar">
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                    {editForm.soluciones.length === 0 && <li style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No hay soluciones agregadas.</li>}
                  </ul>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="cfg-input"
                      placeholder="Ej. Revisión de pagos no reflejados"
                      value={nuevaSolucion}
                      onChange={e => setNuevaSolucion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSolucion()}
                    />
                    <button className="btn-save" onClick={addSolucion}>Agregar</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button className="th-btn-cancel" onClick={handleCancel}>Cancelar</button>
                  <button className="btn-save" onClick={() => handleSave(area.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={16} /> Guardar Cambios
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={area.id} className="settings-card sc-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
                    {area.nombre_area}
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: isGlobal ? '#10b981' : '#64748b', marginLeft: '6px' }}>{labelEmpresa}</span>
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{area.descripcion}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="th-btn-icon" onClick={() => handleEdit(area)} title="Editar">
                    <Edit2 size={16} />
                  </button>
                  {user?.rol === 'admin' && (
                    <button className="th-btn-icon th-btn-delete" onClick={() => handleDelete(area.id)} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: '0.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Puntos Clave / Soluciones</h4>
                {(!area.soluciones || area.soluciones.length === 0) ? (
                  <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>Sin soluciones definidas.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '14px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {area.soluciones.map((sol, i) => <li key={i}>{sol}</li>)}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
        {areas.length === 0 && (
          <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No hay áreas configuradas para esta empresa.
          </div>
        )}
      </div>
    </div>
  );
};

export default AreasSolucionesSection;
