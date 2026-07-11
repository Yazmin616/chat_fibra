import React from 'react';
import { Users, Info, Settings2, UserPlus, Eye, Save } from 'lucide-react';
import { useSectionSave, SectionStatus } from '../settingsUtils';
import { apiService } from '../../../services/api';

const AsignacionStaffSection = ({ config, onSave, setDirty, empresaId, user }) => {
  const { saveState, runSave } = useSectionSave(setDirty);
  const [areas, setAreas] = React.useState([]);
  const [selectedArea, setSelectedArea] = React.useState('');
  const [loadingConfig, setLoadingConfig] = React.useState(false);

  // Maintain local state to reflect toggles immediately before saving globally
  const [localConfig, setLocalConfig] = React.useState({
    auto_asignar_primer_respuesta: config.auto_asignar_primer_respuesta !== 'false',
    autoasignacion_equitativa: config.autoasignacion_equitativa === 'true',
    mostrar_staff_chat: config.mostrar_staff_chat === 'true'
  });
  
  const [isDirtyLocal, setIsDirtyLocal] = React.useState(false);

  // Cargar áreas
  React.useEffect(() => {
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

  // Cargar config cuando cambia el área
  React.useEffect(() => {
    let mounted = true;
    setLoadingConfig(true);
    
    // Si selectedArea es vacío (''), cargamos la global.
    // getConfigs ahora soporta el parámetro area.
    apiService.getConfigs(empresaId, selectedArea || '').then(data => {
      if (!mounted) return;
      setLocalConfig({
        auto_asignar_primer_respuesta: data.auto_asignar_primer_respuesta !== 'false',
        autoasignacion_equitativa: data.autoasignacion_equitativa === 'true',
        mostrar_staff_chat: data.mostrar_staff_chat === 'true'
      });
      setIsDirtyLocal(false);
      setDirty(false);
      setLoadingConfig(false);
    }).catch(() => {
      if (mounted) setLoadingConfig(false);
    });
    
    return () => { mounted = false; };
  }, [empresaId, selectedArea, setDirty]);

  const handleChange = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setIsDirtyLocal(true);
    setDirty(true);
  };

  const handleSave = () => runSave(
    // Re-envolvemos onSave para inyectarle el área actual
    async (arr) => {
      for (const [k, v] of arr) {
        await onSave(k, v, selectedArea || '');
      }
    },
    [
      ['auto_asignar_primer_respuesta', localConfig.auto_asignar_primer_respuesta ? 'true' : 'false'],
      ['autoasignacion_equitativa', localConfig.autoasignacion_equitativa ? 'true' : 'false'],
      ['mostrar_staff_chat', localConfig.mostrar_staff_chat ? 'true' : 'false']
    ]
  ).then(() => setIsDirtyLocal(false));

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><Users size={20} /></span> Asignación de Staff</h2>
        <p>Configura cómo se asignan los chats a los agentes y qué información ve el cliente.</p>
        
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

      {loadingConfig ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Cargando configuración...</div>
      ) : (
        <>
          <div className="sc-phase" style={{ marginTop: '20px' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 size={16} /> Reglas de Asignación</span>
        </div>
        <div className="sc-phase-body">
            <div className="sc-phase" style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '15px' }}>
              <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <UserPlus size={20} color="#64748b" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: '600' }}>Auto asignar staff</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>Se asignará automáticamente la conversación al primer staff en responder. Si se apaga, el chat seguirá en espera hasta que alguien lo asigne manualmente.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }}
                  checked={localConfig.auto_asignar_primer_respuesta}
                  onChange={(e) => handleChange('auto_asignar_primer_respuesta', e.target.checked)}
                />
              </label>
            </div>

            <div className="sc-phase" style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '15px' }}>
              <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Users size={20} color="#64748b" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: '600' }}>Autoasignación equitativa (Round-Robin)</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>Reparte las conversaciones nuevas de forma justa y ordenada entre todos los agentes activos (online) del área correspondiente, uno por uno.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }}
                  checked={localConfig.autoasignacion_equitativa}
                  onChange={(e) => handleChange('autoasignacion_equitativa', e.target.checked)}
                />
              </label>
            </div>
        </div>
      </div>

      <div className="sc-phase" style={{ marginTop: '20px' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Eye size={16} /> Visibilidad del Agente</span>
        </div>
        <div className="sc-phase-body">
            <div className="sc-phase" style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '15px' }}>
              <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Info size={20} color="#64748b" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: '600' }}>Mostrar staff en la conversación</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>El nombre del agente que está atendiendo el chat se enviará como prefijo en su primer mensaje o en todos sus mensajes.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }}
                  checked={localConfig.mostrar_staff_chat}
                  onChange={(e) => handleChange('mostrar_staff_chat', e.target.checked)}
                />
              </label>
            </div>
        </div>
      </div>
      
      <div className="sc-footer">
        {isDirtyLocal && <span style={{ color: '#d97706', fontSize: '13px', fontWeight: '500', marginRight: 'auto' }}>
          ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar cambios" para aplicarlos.
        </span>}
        <SectionStatus state={saveState} />
        <button 
          className="btn-save" 
          onClick={handleSave} 
          disabled={!isDirtyLocal || saveState === 'saving'}
        >
          {saveState === 'saving' ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
      </>
      )}
    </div>
  );
};

export default AsignacionStaffSection;
