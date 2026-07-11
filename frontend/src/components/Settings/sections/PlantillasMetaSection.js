import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { apiService } from '../../../services/api';

const PlantillasMetaSection = ({ empresaId }) => {
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'UTILITY',
    idioma: 'es',
    estado: 'APPROVED',
    cuerpo: ''
  });

  useEffect(() => {
    fetchPlantillas();
  }, [empresaId]);

  const fetchPlantillas = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPlantillasMeta(empresaId);
      setPlantillas(data);
    } catch (err) {
      setError('Error al cargar plantillas de Meta');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const nueva = await apiService.createPlantillaMeta(empresaId, formData);
      setPlantillas(prev => [...prev, nueva]);
      setShowModal(false);
      setFormData({ nombre: '', categoria: 'UTILITY', idioma: 'es', estado: 'APPROVED', cuerpo: '' });
    } catch (err) {
      alert(err.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta plantilla?')) return;
    try {
      await apiService.deletePlantillaMeta(empresaId, id);
      setPlantillas(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message || 'Error al eliminar');
    }
  };

  if (loading) return <div style={{ padding: '20px', color: '#666' }}>Cargando...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2><span className="cfg-section-icon-h"><MessageSquare size={20} /></span> Plantillas de Meta</h2>
          <p>Catálogo de plantillas pre-aprobadas para iniciar conversaciones (fuera de la ventana de 24 horas).</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-save"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Agregar Plantilla
        </button>
      </div>

      <div className="settings-card sc-card" style={{ padding: 0, maxWidth: '100%' }}>
        <table className="sc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Nombre</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Categoría</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Idioma</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Estado</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {plantillas.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No hay plantillas registradas</td></tr>
            ) : (
              plantillas.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>{p.nombre}</td>
                  <td style={{ padding: '12px 16px' }}>{p.categoria}</td>
                  <td style={{ padding: '12px 16px' }}>{p.idioma}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 8px', background: '#22c55e', color: 'white', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                      {p.estado}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(p.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={18} /> Agregar Plantilla Aprobada</h3>
            <p style={{ fontSize: '13px', color: '#666' }}>
              El nombre debe coincidir EXACTAMENTE con el aprobado en Meta (ej: <code>aviso_pago</code>).
            </p>
            <form onSubmit={handleSave}>
              <div className="setting-item sc-row" style={{ padding: '10px 0', borderBottom: 'none' }}>
                <div style={{ width: '100%' }}>
                  <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>Nombre de la Plantilla</label>
                  <input 
                    type="text" 
                    value={formData.nombre} 
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                    required 
                  />
                </div>
              </div>
              <div className="setting-item sc-row" style={{ padding: '10px 0', borderBottom: 'none' }}>
                <div style={{ width: '100%' }}>
                  <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>Categoría</label>
                  <select 
                    value={formData.categoria} 
                    onChange={e => setFormData({...formData, categoria: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                  >
                    <option value="UTILITY">Utilidad (Utility)</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Autenticación</option>
                  </select>
                </div>
              </div>
              <div className="setting-item sc-row" style={{ padding: '10px 0', borderBottom: 'none' }}>
                <div style={{ width: '100%' }}>
                  <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>Idioma</label>
                  <input 
                    type="text" 
                    value={formData.idioma} 
                    onChange={e => setFormData({...formData, idioma: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                    required 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-save"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantillasMetaSection;
