import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { DEFAULTS, SectionStatus, useSectionSave } from '../settingsUtils';

const DIAS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

/**
 * Sección: Jornada laboral
 * Configura el horario y los días de atención.
 */
const JornadaSection = ({ config, onSave, setDirty }) => {
  const [inicio, setInicio] = useState(config.jornada_inicio ?? DEFAULTS.jornada_inicio);
  const [fin,    setFin]    = useState(config.jornada_fin    ?? DEFAULTS.jornada_fin);
  const [dias,   setDias]   = useState(config.jornada_dias   ?? DEFAULTS.jornada_dias);

  const { saveState, runSave } = useSectionSave(setDirty);

  const diasSet = new Set(dias.split(',').map(Number));
  const toggleDia = (d) => {
    const s = new Set(diasSet);
    s.has(d) ? s.delete(d) : s.add(d);
    const str = [...s].sort((a, b) => a - b).join(',');
    setDias(str);
    setDirty(true);
  };

  const handleSave = () => runSave(onSave, [
    ['jornada_inicio', inicio],
    ['jornada_fin',    fin],
    ['jornada_dias',   dias],
  ]);

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><Clock size={20} /></span> Jornada laboral</h2>
        <p>
          Infracciones y cierres por inactividad del agente solo aplican dentro del horario laboral.
          Las conversaciones en espera tienen 24 h reales para ser tomadas (ventana Meta).
        </p>
      </div>

      <div className="settings-card sc-card">
        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="j-inicio">Hora de inicio</label>
            <span>Hora a partir de la cual los agentes están disponibles.</span>
          </div>
          <div className="setting-control">
            <input
              id="j-inicio"
              type="time"
              value={inicio}
              onChange={e => { setInicio(e.target.value); setDirty(true); }}
            />
          </div>
        </div>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="j-fin">Hora de fin</label>
            <span>Hora a la que termina la jornada laboral.</span>
          </div>
          <div className="setting-control">
            <input
              id="j-fin"
              type="time"
              value={fin}
              onChange={e => { setFin(e.target.value); setDirty(true); }}
            />
          </div>
        </div>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label>Días laborales</label>
            <span>Días en que los agentes atienden clientes.</span>
          </div>
          <div className="setting-control" style={{ flexWrap: 'wrap', gap: '6px' }}>
            {DIAS.map(({ value, label }) => (
              <label key={value} className={`sc-dia${diasSet.has(value) ? ' sc-dia--on' : ''}`}>
                <input type="checkbox" style={{ display: 'none' }}
                  checked={diasSet.has(value)} onChange={() => toggleDia(value)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="sc-footer">
          <SectionStatus state={saveState} />
          <button className="btn-save" disabled={saveState === 'saving'} onClick={handleSave}>
            {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JornadaSection;
