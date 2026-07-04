import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { DEFAULTS, TimeField, SectionStatus, bestUnit, useSectionSave } from '../settingsUtils';

/**
 * Sección: Inactividad del bot
 * Controla el tiempo para cerrar sesiones del menú automático (sin agente).
 */
const InactividadBotSection = ({ config, onSave, setDirty }) => {
  const initMin = config.tiempo_inactividad ?? DEFAULTS.tiempo_inactividad;

  const [minutes, setMinutes] = useState(String(initMin));
  const [unit,    setUnit]    = useState(() => bestUnit(initMin).unit);
  const { saveState, runSave } = useSectionSave(setDirty);

  const handleChange = (m) => {
    setMinutes(String(m));
    setDirty(true);
  };

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><Bot size={20} /></span> Inactividad del bot</h2>
        <p>Tiempo sin mensajes para cerrar automáticamente sesiones del menú del bot (sin agente humano).</p>
      </div>

      <div className="settings-card sc-card">
        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="bot-inac">Cerrar sesión de bot tras</label>
            <span>Solo aplica al menú automático. Los chats con agentes humanos tienen su propio temporizador.</span>
          </div>
          <TimeField
            id="bot-inac"
            minutes={minutes}
            unit={unit}
            onChangeMinutes={handleChange}
            onChangeUnit={setUnit}
          />
        </div>

        <div className="sc-footer">
          <SectionStatus state={saveState} />
          <button
            className="btn-save"
            disabled={saveState === 'saving'}
            onClick={() => runSave(onSave, [['tiempo_inactividad', minutes]])}
          >
            {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactividadBotSection;
