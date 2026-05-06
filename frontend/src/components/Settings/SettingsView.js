import React from 'react';

const SettingsView = ({ config, setConfig, onSave }) => (
  <div className="settings-view">
    <div className="settings-header">
      <h2>Configuración del Sistema</h2>
      <p>Ajusta los parámetros globales del chatbot y CRM.</p>
    </div>
    
    <div className="settings-card">
      <div className="setting-item">
        <div className="setting-info">
          <label>Tiempo de Inactividad (Minutos)</label>
          <span>Minutos que deben pasar sin mensajes para que el chat se cierre automáticamente.</span>
        </div>
        <div className="setting-control">
          <input 
            type="number" 
            value={config.tiempo_inactividad || 10} 
            onChange={(e) => setConfig({...config, tiempo_inactividad: e.target.value})}
          />
          <button className="btn-save" onClick={() => onSave('tiempo_inactividad', config.tiempo_inactividad)}>Guardar</button>
        </div>
      </div>
    </div>
  </div>
);

export default SettingsView;
