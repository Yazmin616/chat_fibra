import React, { useState, useEffect } from 'react';
import { Bot, Info } from 'lucide-react';
import { apiService } from '../../../services/api';
import { MessageField } from '../settingsUtils';

const PlantillasBotSection = ({ empresaId }) => {
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlantillas();
  }, [empresaId]);

  const fetchPlantillas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getPlantillasBot(empresaId);
      setPlantillas(data);
    } catch (err) {
      console.error('Error fetching plantillas:', err);
      setError('No se pudieron cargar las plantillas del bot.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTexto = (clave, newText) => {
    setPlantillas(prev => prev.map(p => 
      p.clave === clave ? { ...p, texto: newText, dirty: true } : p
    ));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const dirtyPlantillas = plantillas.filter(p => p.dirty);
      for (const p of dirtyPlantillas) {
        await apiService.updatePlantillaBot(p.clave, p.texto, empresaId);
      }
      
      setPlantillas(prev => prev.map(p => 
        p.dirty ? { ...p, es_personalizado: true, dirty: false } : p
      ));
    } catch (err) {
      console.error('Error saving plantillas:', err);
      alert('Error al guardar las plantillas: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = plantillas.some(p => p.dirty);

  if (loading) return <div style={{ padding: '20px', color: '#666' }}>Cargando plantillas...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><Bot size={20} /></span> Mensajes del Bot Automático</h2>
        <p>
          Personaliza los mensajes que el asistente virtual envía a los clientes. 
          Puedes usar variables como {'{{nombre}}'} si están disponibles para la plantilla.
        </p>
      </div>

      <div className="sc-alert sc-alert--info" style={{ marginBottom: 20 }}>
        <Info size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} />
        <strong>Nota importante:</strong> Algunas plantillas utilizan variables como <code>{'{'}{'{nombre}'}{'}'}</code> o <code>{'{'}{'{empresa}'}{'}'}</code>. 
        Asegúrate de dejarlas tal cual para que el bot las reemplace automáticamente.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {plantillas.map((plantilla, index) => (
          <div key={plantilla.clave} className="sc-phase">
            <div className="sc-phase-head">
              <span className="sc-phase-num" style={{ background: '#3b82f6' }}>{index + 1}</span>
              <span className="sc-phase-name">{plantilla.clave} {plantilla.es_personalizado && <span style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 'normal', marginLeft: '10px' }}>Personalizada</span>}</span>
            </div>

            <p className="sc-hint" style={{ marginTop: '5px' }}>
              {plantilla.descripcion}
            </p>

            <MessageField
              id={`plantilla-${plantilla.clave}`}
              value={plantilla.texto}
              onChange={(val) => handleChangeTexto(plantilla.clave, val)}
            />
          </div>
        ))}
      </div>

      <div className="sc-footer">
        {isDirty && <span style={{ color: '#d97706', fontSize: '13px', fontWeight: '500', marginRight: 'auto' }}>
          ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar cambios" para aplicarlos.
        </span>}
        <button
          className="btn-save"
          disabled={saving || !isDirty}
          onClick={handleSaveAll}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

export default PlantillasBotSection;
