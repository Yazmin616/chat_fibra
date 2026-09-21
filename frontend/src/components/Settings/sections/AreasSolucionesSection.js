import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search, Shield, Building2, Check, AlertCircle } from 'lucide-react';
import { apiService } from '../../../services/api';
import { EMPRESAS_DEF } from '../../../hooks/usePermisos';

const AreasSolucionesSection = ({ empresaId = 'todas', user }) => {
  const [areas, setAreas] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal de Crear / Editar Área
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nombre_area: '',
    descripcion: '',
    empresa_id: ['todas'],
    coordinador_id: '',
    soluciones: []
  });
  const [nuevaSolucion, setNuevaSolucion] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  const esAdmin = user?.rol === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      const [areasData, agentesData] = await Promise.all([
        apiService.getAreasSoluciones(empresaId, { catalogo: true }),
        apiService.getAgentes().catch(() => [])
      ]);
      setAreas(Array.isArray(areasData) ? areasData : []);
      setAgentes(Array.isArray(agentesData) ? agentesData : []);
    } catch (error) {
      alert('Error cargando áreas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [empresaId]);

  // Abrir modal para crear
  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      nombre_area: '',
      descripcion: '',
      empresa_id: empresaId === 'todas' ? ['todas'] : [empresaId],
      coordinador_id: '',
      soluciones: []
    });
    setNuevaSolucion('');
    setErrorModal('');
    setModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (area) => {
    setEditingId(area.id);
    let empArr = Array.isArray(area.empresa_id) ? area.empresa_id : [area.empresa_id || 'todas'];
    setForm({
      nombre_area: area.nombre_area || '',
      descripcion: area.descripcion || '',
      empresa_id: empArr,
      coordinador_id: area.coordinador_id ? String(area.coordinador_id) : '',
      soluciones: Array.isArray(area.soluciones) ? [...area.soluciones] : []
    });
    setNuevaSolucion('');
    setErrorModal('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setErrorModal('');
  };

  // Guardar (Crear o Actualizar)
  const handleSaveArea = async (e) => {
    if (e) e.preventDefault();
    const nombre = form.nombre_area.trim();
    if (!nombre) {
      setErrorModal('El nombre del área o departamento es requerido.');
      return;
    }

    setSaving(true);
    setErrorModal('');
    try {
      const payload = {
        nombre_area: nombre,
        descripcion: form.descripcion.trim(),
        empresa_id: form.empresa_id,
        coordinador_id: form.coordinador_id ? Number(form.coordinador_id) : null,
        soluciones: form.soluciones
      };

      if (editingId) {
        await apiService.updateAreaSolucion(editingId, payload);
      } else {
        await apiService.createAreaSolucion(payload);
      }

      setModalOpen(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setErrorModal(err.message || 'Error al procesar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar
  const handleDeleteArea = async (area) => {
    if (!window.confirm(`¿Deseas eliminar el área "${area.nombre_area}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await apiService.deleteAreaSolucion(area.id);
      await loadData();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // Soluciones
  const addSolucion = () => {
    const val = nuevaSolucion.trim();
    if (!val) return;
    if (form.soluciones.includes(val)) {
      setErrorModal('Esta solución ya fue agregada.');
      return;
    }
    setForm(prev => ({
      ...prev,
      soluciones: [...prev.soluciones, val]
    }));
    setNuevaSolucion('');
    setErrorModal('');
  };

  const removeSolucion = (idx) => {
    setForm(prev => ({
      ...prev,
      soluciones: prev.soluciones.filter((_, i) => i !== idx)
    }));
  };

  // Filtrado de áreas
  const filteredAreas = areas.filter(a => {
    const term = search.toLowerCase();
    const matchNombre = (a.nombre_area || '').toLowerCase().includes(term);
    const matchDesc = (a.descripcion || '').toLowerCase().includes(term);
    return matchNombre || matchDesc;
  });

  return (
    <div className="cfg-section-wrap" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Cabecera */}
      <div className="cfg-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
            <span className="cfg-section-icon-h" style={{ display: 'inline-flex', alignItems: 'center', color: '#2563eb' }}><Building2 size={22} /></span>
            Áreas y Departamentos
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Catálogo institucional de departamentos, líderes responsables y puntos clave de atención.
          </p>
        </div>

        {esAdmin && (
          <button
            type="button"
            className="btn-save"
            onClick={handleOpenCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Plus size={16} /> Agregar Área o Departamento
          </button>
        )}
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="cfg-input"
            placeholder="Buscar área o departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px', borderRadius: '6px' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
          {filteredAreas.length} departamento(s) registrado(s)
        </span>
      </div>

      {/* Lista de Áreas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' }}>
          Cargando catálogo de áreas...
        </div>
      ) : filteredAreas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          <Building2 size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
            No se encontraron áreas o departamentos con ese criterio.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredAreas.map(area => {
            const empArr = Array.isArray(area.empresa_id) ? area.empresa_id : [area.empresa_id || 'todas'];
            const isGlobal = empArr.includes('todas');
            const coord = area.coordinador_nombre;

            return (
              <div
                key={area.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'border-color 0.2s'
                }}
              >
                <div>
                  {/* Encabezado Tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {area.nombre_area}
                      </h3>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {isGlobal ? (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: '#ecfdf5', color: '#059669' }}>
                            Global (Todas las empresas)
                          </span>
                        ) : (
                          empArr.map(eid => {
                            const empObj = EMPRESAS_DEF.find(e => e.id === eid);
                            return (
                              <span key={eid} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb' }}>
                                {empObj?.label || eid}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleOpenEdit(area)}
                        title="Editar departamento"
                        style={{
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      {esAdmin && (
                        <button
                          onClick={() => handleDeleteArea(area)}
                          title="Eliminar departamento"
                          style={{
                            border: '1px solid #fee2e2',
                            background: '#fef2f2',
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Descripción */}
                  <p style={{ margin: '6px 0 12px 0', fontSize: '13px', color: '#64748b', minHeight: '36px', lineHeight: 1.4 }}>
                    {area.descripcion || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Sin descripción registrada.</span>}
                  </p>

                  {/* Líder / Coordinador */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', border: '1px solid #f1f5f9' }}>
                    <Shield size={14} style={{ color: coord ? '#2563eb' : '#94a3b8' }} />
                    <span style={{ color: '#475569', fontWeight: 500 }}>Líder:</span>
                    <span style={{ color: coord ? '#1e293b' : '#94a3b8', fontWeight: coord ? 600 : 400 }}>
                      {coord || 'Sin coordinador asignado'}
                    </span>
                  </div>
                </div>

                {/* Soluciones Asociadas */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>
                    Soluciones clave ({Array.isArray(area.soluciones) ? area.soluciones.length : 0})
                  </span>
                  {Array.isArray(area.soluciones) && area.soluciones.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {area.soluciones.slice(0, 3).map((s, idx) => (
                        <span key={idx} style={{ fontSize: '11px', background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                          {s}
                        </span>
                      ))}
                      {area.soluciones.length > 3 && (
                        <span style={{ fontSize: '11px', color: '#64748b', padding: '2px 4px' }}>
                          +{area.soluciones.length - 3} más
                        </span>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Sin soluciones específicas asignadas
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '24px',
            boxSizing: 'border-box'
          }}>
            
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} style={{ color: '#2563eb' }} />
                {editingId ? 'Editar Área o Departamento' : 'Nueva Área o Departamento'}
              </h3>
              <button
                onClick={handleCloseModal}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {errorModal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{errorModal}</span>
              </div>
            )}

            <form onSubmit={handleSaveArea}>
              
              {/* Nombre */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Nombre del Área o Departamento <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="cfg-input"
                  placeholder="Ej. Auditoría y Procesos, NOC, Cobranza..."
                  value={form.nombre_area}
                  onChange={e => setForm({ ...form, nombre_area: e.target.value })}
                  autoFocus
                  required
                />
              </div>

              {/* Empresa */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Pertenece a la Empresa
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Botón Global */}
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '20px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: `1px solid ${form.empresa_id.includes('todas') ? '#10b981' : '#cbd5e1'}`,
                    backgroundColor: form.empresa_id.includes('todas') ? '#ecfdf5' : '#f8fafc',
                    color: form.empresa_id.includes('todas') ? '#047857' : '#64748b'
                  }}>
                    <input
                      type="checkbox"
                      style={{ display: 'none' }}
                      checked={form.empresa_id.includes('todas')}
                      onChange={() => setForm({ ...form, empresa_id: ['todas'] })}
                    />
                    {form.empresa_id.includes('todas') && <Check size={12} />}
                    Global (Todas las Empresas)
                  </label>

                  {/* Empresas individuales */}
                  {EMPRESAS_DEF.map(emp => {
                    const isSelected = form.empresa_id.includes(emp.id);
                    const isGlobal = form.empresa_id.includes('todas');
                    return (
                      <label key={emp.id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '20px',
                        cursor: isGlobal ? 'not-allowed' : 'pointer',
                        userSelect: 'none',
                        opacity: isGlobal ? 0.5 : 1,
                        border: `1px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? '#1d4ed8' : '#64748b'
                      }}>
                        <input
                          type="checkbox"
                          style={{ display: 'none' }}
                          disabled={isGlobal}
                          checked={isSelected}
                          onChange={() => {
                            let curr = form.empresa_id.filter(id => id !== 'todas');
                            if (isSelected) {
                              curr = curr.filter(id => id !== emp.id);
                            } else {
                              curr.push(emp.id);
                            }
                            if (curr.length === 0) curr = ['todas'];
                            setForm({ ...form, empresa_id: curr });
                          }}
                        />
                        {isSelected && !isGlobal && <Check size={12} />}
                        {emp.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Descripción de Funciones
                </label>
                <textarea
                  className="cfg-input"
                  rows={2}
                  placeholder="Describe brevemente el alcance de este departamento..."
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  style={{ height: 'auto', resize: 'vertical' }}
                />
              </div>

              {/* Coordinador / Líder */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Coordinador Responsable (Opcional)
                </label>
                <select
                  className="cfg-input"
                  value={form.coordinador_id}
                  onChange={e => setForm({ ...form, coordinador_id: e.target.value })}
                >
                  <option value="">Sin coordinador asignado</option>
                  {agentes.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.nombre} ({ag.usuario}) — {ag.area || ag.rol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Soluciones Asociadas */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Soluciones y Puntos Clave
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="cfg-input"
                    placeholder="Ej. Reconexión tras pago, Cambio de contraseña..."
                    value={nuevaSolucion}
                    onChange={e => setNuevaSolucion(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSolucion();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addSolucion}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      padding: '0 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Agregar
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                  {form.soluciones.map((sol, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <span style={{ color: '#1e293b' }}>• {sol}</span>
                      <button
                        type="button"
                        onClick={() => removeSolucion(idx)}
                        style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {form.soluciones.length === 0 && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                      No se han agregado soluciones para esta área.
                    </span>
                  )}
                </div>
              </div>

              {/* Botones Acciones Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={15} /> {saving ? 'Guardando...' : 'Guardar Departamento'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AreasSolucionesSection;
