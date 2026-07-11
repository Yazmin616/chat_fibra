import React, { useState, useEffect } from 'react';
import { MapPin, Info } from 'lucide-react';
import { apiService } from '../../../services/api';
import { MessageField } from '../settingsUtils';

const UbicacionesCobroSection = ({ empresaId, user }) => {
  const [ubicaciones, setUbicaciones] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');

  useEffect(() => {
    apiService.getAreas(empresaId).then(fetchedAreas => {
      setAreas(fetchedAreas);
      if (user?.rol !== 'admin') {
        if (fetchedAreas.length > 0) {
          if (!selectedArea || !fetchedAreas.includes(selectedArea)) {
            setSelectedArea(fetchedAreas[0]);
          }
        } else {
          setSelectedArea('');
        }
      } else {
        if (!fetchedAreas.includes(selectedArea) && selectedArea !== '') {
          setSelectedArea('');
        }
      }
    }).catch(console.error);
  }, [empresaId, user?.rol]);

  useEffect(() => {
    fetchConfig();
  }, [empresaId, selectedArea]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const config = await apiService.getConfigs(empresaId, selectedArea || '');
      setUbicaciones(config.ubicaciones_cobro || '');
      setDirty(false);
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('No se pudo cargar la configuración de ubicaciones.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (newVal) => {
    setUbicaciones(newVal);
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updateConfig('ubicaciones_cobro', ubicaciones, empresaId, selectedArea || '');
      setDirty(false);
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', color: '#666' }}>Cargando ubicaciones...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div className="cfg-section fade-in">
      <div className="cfg-section-header">
        <MapPin size={24} className="cfg-icon" />
        <div>
          <h2 className="cfg-title">Ubicaciones de Cobro</h2>
          <p className="cfg-desc">Configura las direcciones y horarios de las sucursales donde los clientes pueden pagar.</p>
          
          <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>Configuración para:</label>
            <select 
              value={selectedArea} 
              onChange={(e) => setSelectedArea(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
            >
              {user?.rol === 'admin' && <option value="">Global (Por defecto)</option>}
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="cfg-card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 15 }}>
          <Info size={16} color="#0052cc" />
          <span style={{ fontSize: 13, color: '#333' }}>
            Este texto se enviará automáticamente cuando el cliente pregunte "dónde pagar" o "ubicaciones de cobro".
          </span>
        </div>

        <MessageField 
          label="Texto de ubicaciones y horarios"
          value={ubicaciones}
          onChange={handleChange}
          placeholder="📍 Sucursal Centro\nAv. Principal 123..."
          rows={10}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button 
            className="cfg-btn-primary" 
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UbicacionesCobroSection;
