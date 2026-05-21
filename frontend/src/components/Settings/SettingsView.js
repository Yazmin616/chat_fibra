import React from 'react';

const DIAS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

/**
 * @param {object}   props
 * @param {object}   props.config    - Configuración actual { tiempo_inactividad, jornada_inicio, jornada_fin, jornada_dias }.
 * @param {Function} props.setConfig - Setter local para actualizar antes de guardar.
 * @param {(clave: string, valor: string) => Promise<void>} props.onSave - Persiste el cambio en el backend.
 */
const SettingsView = ({ config, setConfig, onSave }) => {
  const diasActivos = new Set(
    (config.jornada_dias || '1,2,3,4,5').split(',').map(Number)
  );

  const toggleDia = (dia) => {
    const nuevo = new Set(diasActivos);
    if (nuevo.has(dia)) nuevo.delete(dia);
    else nuevo.add(dia);
    const str = [...nuevo].sort((a, b) => a - b).join(',');
    setConfig({ ...config, jornada_dias: str });
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2>Configuración del Sistema</h2>
        <p>Ajusta los parámetros globales del chatbot y CRM.</p>
      </div>

      <div className="settings-card">
        <div className="setting-item">
          <div className="setting-info">
            <label>Tiempo de Inactividad (Minutos)</label>
            <span>Minutos sin mensajes para cerrar automáticamente un chat en atención.</span>
          </div>
          <div className="setting-control">
            <input
              type="number"
              min="1"
              value={config.tiempo_inactividad || 10}
              onChange={(e) => setConfig({ ...config, tiempo_inactividad: e.target.value })}
            />
            <button className="btn-save" onClick={() => onSave('tiempo_inactividad', config.tiempo_inactividad)}>
              Guardar
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Jornada Laboral</h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary, #888)' }}>
          Infracciones y cierres automáticos solo se generan dentro del horario laboral.
          Las conversaciones en espera tienen 24 h reales para ser tomadas (ventana Meta).
        </p>

        <div className="setting-item">
          <div className="setting-info">
            <label>Hora de inicio</label>
            <span>Hora a partir de la cual los agentes están disponibles.</span>
          </div>
          <div className="setting-control">
            <input
              type="time"
              value={config.jornada_inicio || '09:00'}
              onChange={(e) => setConfig({ ...config, jornada_inicio: e.target.value })}
            />
            <button className="btn-save" onClick={() => onSave('jornada_inicio', config.jornada_inicio || '09:00')}>
              Guardar
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label>Hora de fin</label>
            <span>Hora a la que termina la jornada laboral.</span>
          </div>
          <div className="setting-control">
            <input
              type="time"
              value={config.jornada_fin || '18:00'}
              onChange={(e) => setConfig({ ...config, jornada_fin: e.target.value })}
            />
            <button className="btn-save" onClick={() => onSave('jornada_fin', config.jornada_fin || '18:00')}>
              Guardar
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label>Días laborales</label>
            <span>Días en que los agentes atienden clientes.</span>
          </div>
          <div className="setting-control" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DIAS.map(({ value, label }) => (
                <label
                  key={value}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            '4px',
                    cursor:         'pointer',
                    padding:        '4px 10px',
                    borderRadius:   '6px',
                    border:         '1px solid var(--border, #ddd)',
                    background:     diasActivos.has(value) ? 'var(--primary, #2563eb)' : 'transparent',
                    color:          diasActivos.has(value) ? '#fff' : 'inherit',
                    fontSize:       '13px',
                    userSelect:     'none',
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ display: 'none' }}
                    checked={diasActivos.has(value)}
                    onChange={() => toggleDia(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              className="btn-save"
              onClick={() => onSave('jornada_dias', config.jornada_dias || '1,2,3,4,5')}
            >
              Guardar días
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
