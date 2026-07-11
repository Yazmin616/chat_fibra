import React, { useState, useEffect } from 'react';
import { Wrench, Info, Briefcase, DollarSign } from 'lucide-react';
import { MessageField, SectionStatus, useSectionSave } from '../settingsUtils';
import { apiService } from '../../../services/api';
import { EMPRESAS_DEF } from '../../../hooks/usePermisos';

const TELEFONO_DEFAULT = '';

const MantenimientoGlobal = ({ setDirty }) => {
  const [globalMsg, setGlobalMsg] = useState('');
  const [companyData, setCompanyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('idle');
  const [isDirty, setIsDirtyLocal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(EMPRESAS_DEF[0]?.id);

  useEffect(() => {
    setLoading(true);
    Promise.all(EMPRESAS_DEF.map(emp => 
      Promise.all([
        apiService.getConfigs(emp.id),
        apiService.getAreasSoluciones(emp.id)
      ])
    )).then(results => {
      const newData = {};
      let firstMsg = '';
      results.forEach(([cfg, areas], idx) => {
        const empId = EMPRESAS_DEF[idx].id;
        if (!firstMsg && cfg.msg_mantenimiento) firstMsg = cfg.msg_mantenimiento;
        let initExts = {};
        try {
          if (cfg.extensiones_areas) initExts = JSON.parse(cfg.extensiones_areas);
        } catch(e){}
        newData[empId] = {
          telEmpresa: cfg.tel_empresa || '',
          exts: initExts,
          areas: areas || []
        };
      });
      setGlobalMsg(firstMsg);
      setCompanyData(newData);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const promises = [];
      for (const emp of EMPRESAS_DEF) {
        const data = companyData[emp.id];
        if (!data) continue;
        const cleanedExts = {};
        if (Array.isArray(data.areas)) {
          data.areas.forEach(area => {
            if (data.exts && data.exts[area.nombre_area] !== undefined) {
              cleanedExts[area.nombre_area] = data.exts[area.nombre_area];
            }
          });
        }
        promises.push(apiService.updateConfig('msg_mantenimiento', globalMsg, emp.id));
        promises.push(apiService.updateConfig('tel_empresa', data.telEmpresa, emp.id));
        promises.push(apiService.updateConfig('extensiones_areas', JSON.stringify(cleanedExts), emp.id));
      }
      await Promise.all(promises);
      setSaveState('saved');
      setDirty(false);
      setIsDirtyLocal(false);
      setTimeout(() => setSaveState('idle'), 3000);
    } catch(e) {
      console.error(e);
      setSaveState(e.message ? `error: ${e.message}` : 'error');
    }
  };

  const updateCompany = (empId, field, value) => {
    setCompanyData(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: value }
    }));
    setDirty(true);
    setIsDirtyLocal(true);
  };
  
  const updateExtension = (empId, areaName, value) => {
    setCompanyData(prev => ({
      ...prev,
      [empId]: { 
        ...prev[empId], 
        exts: { ...prev[empId].exts, [areaName]: value }
      }
    }));
    setDirty(true);
    setIsDirtyLocal(true);
  };

  if (loading) return <div style={{ padding: 20 }}>Cargando configuración global...</div>;

  return (
    <div className="cfg-section-wrap">
       <div className="cfg-section-header">
         <h2><span className="cfg-section-icon-h"><Wrench size={20} /></span> Mantenimiento (Global)</h2>
         <p>Estás editando la configuración para <strong>todas las empresas</strong> al mismo tiempo. El mensaje será el mismo para todas, pero los teléfonos serán los específicos de cada una.</p>
       </div>
       
       <div className="sc-phase sc-phase--1" style={{ borderLeftColor: '#f59e0b' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#f59e0b' }}>1</span>
          <span className="sc-phase-name">Mensaje global de mantenimiento</span>
        </div>
        <p className="sc-hint">
          Usa <code>{'{empresa}'}</code> para el nombre de la empresa y <code>{'{telefonos_areas}'}</code> para insertar los teléfonos de contacto.
        </p>
        <MessageField id="mant-msg-global" value={globalMsg} onChange={v => { setGlobalMsg(v); setDirty(true); setIsDirtyLocal(true); }} />
       </div>

       <div className="sc-phase sc-phase--2" style={{ borderLeftColor: '#6366f1' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#6366f1' }}>2</span>
          <span className="sc-phase-name">Teléfonos por Empresa</span>
        </div>
        <p className="sc-hint">
          Estos datos se insertarán dinámicamente en <code>{'{telefonos_areas}'}</code> según la empresa que atienda el bot.<br/>
          (Nota: Si una empresa no muestra extensiones, es porque aún no tiene <b>Áreas</b> creadas en la sección "Áreas y Soluciones").
        </p>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600, marginRight: 10, fontSize: 14 }}>Selecciona la empresa a editar:</label>
          <select 
            className="sc-tel-input" 
            style={{ width: 'auto', display: 'inline-block' }}
            value={selectedEmp} 
            onChange={e => setSelectedEmp(e.target.value)}
          >
            {EMPRESAS_DEF.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.label}</option>
            ))}
          </select>
        </div>

        {selectedEmp && companyData[selectedEmp] && (() => {
          const emp = EMPRESAS_DEF.find(e => e.id === selectedEmp);
          const data = companyData[selectedEmp];
          return (
            <div style={{ padding: 15, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, marginBottom: 15, fontSize: 16, color: '#334155' }}>Editando: {emp?.label}</h3>
              
              <div className="setting-item sc-row">
                <div className="setting-info"><label>Teléfono Principal</label></div>
                <input type="tel" className="sc-tel-input" placeholder="Ej. 55 1234-5678" value={data.telEmpresa} onChange={e => updateCompany(selectedEmp, 'telEmpresa', e.target.value)} />
              </div>

              {data.areas.length === 0 && (
                <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 10 }}>
                  Esta empresa no tiene áreas configuradas.
                </div>
              )}

              {data.areas.map(area => (
                <div className="setting-item sc-row" key={area.id}>
                  <div className="setting-info"><label>Ext. {area.nombre_area}</label></div>
                  <input type="text" className="sc-tel-input" placeholder="Ej. 101" value={data.exts[area.nombre_area] || ''} onChange={e => updateExtension(selectedEmp, area.nombre_area, e.target.value)} />
                </div>
              ))}
            </div>
          );
        })()}
       </div>

       <div className="sc-footer">
        {isDirty && <span style={{ color: '#d97706', fontSize: '13px', fontWeight: '500', marginRight: 'auto' }}>
          ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar cambios globales" para aplicarlos.
        </span>}
        <SectionStatus state={saveState} />
        <button className="btn-save" disabled={saveState === 'saving' || !isDirty} onClick={handleSave}>
          {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios globales'}
        </button>
      </div>
    </div>
  );
};

const MantenimientoSingle = ({ config, onSave, setDirty, empresaId }) => {
  const [msg, setMsg] = useState(config.msg_mantenimiento ?? '');
  const [telEmpresa, setTelEmpresa] = useState(config.tel_empresa ?? TELEFONO_DEFAULT);
  
  let initExts = {};
  try {
    if (config.extensiones_areas) {
      initExts = JSON.parse(config.extensiones_areas);
    } else {
      if (config.ext_soporte) initExts['Soporte Técnico'] = config.ext_soporte;
      if (config.ext_ventas) initExts['Ventas'] = config.ext_ventas;
      if (config.ext_cobranza) initExts['Cobranza'] = config.ext_cobranza;
    }
  } catch(e) {}
  
  const [extensions, setExtensions] = useState(initExts);
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    apiService.getAreasSoluciones(empresaId)
      .then(data => setAreas(data))
      .catch(console.error);
  }, [empresaId]);

  const { saveState, runSave } = useSectionSave(setDirty);

  const isDirty = (
    msg !== (config.msg_mantenimiento ?? '') ||
    telEmpresa !== (config.tel_empresa ?? TELEFONO_DEFAULT) ||
    JSON.stringify(extensions) !== (config.extensiones_areas || JSON.stringify(initExts))
  );

  const handleSave = () => {
    const cleanedExts = {};
    if (Array.isArray(areas)) {
      areas.forEach(area => {
        if (extensions && extensions[area.nombre_area] !== undefined) {
          cleanedExts[area.nombre_area] = extensions[area.nombre_area];
        }
      });
    }
    runSave(onSave, [
      ['msg_mantenimiento', msg],
      ['tel_empresa',       telEmpresa],
      ['extensiones_areas', JSON.stringify(cleanedExts)],
    ]);
  };

  const dirty = (f, set) => (v) => { set(v); setDirty(true); };

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><Wrench size={20} /></span> Modo mantenimiento</h2>
        <p>
          Cuando el modo mantenimiento está activo, la interfaz de agentes se bloquea.
          Los clientes siguen pudiendo escribir y el bot les responde automáticamente
          con este mensaje — una sola vez por hora para no saturarlos.
        </p>
      </div>

      <div className="sc-alert sc-alert--info" style={{ marginBottom: 20 }}>
        <Info size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} /> Activa o desactiva el mantenimiento desde el panel de TI (<strong>Ajustes del sistema</strong>).
        Aquí solo configuras el mensaje que reciben los clientes mientras dure.
      </div>

      <div className="sc-phase sc-phase--1" style={{ borderLeftColor: '#f59e0b' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#f59e0b' }}>1</span>
          <span className="sc-phase-name">Mensaje de mantenimiento</span>
        </div>

        <p className="sc-hint">
          Usa <code>{'{empresa}'}</code> para el nombre de tu empresa y{' '}
          <code>{'{telefonos_areas}'}</code> para insertar los teléfonos de contacto
          configurados abajo. Si dejas el mensaje vacío se usa el texto por defecto.
        </p>

        <MessageField id="mant-msg" value={msg} onChange={dirty(msg, setMsg)} />
      </div>

      <div className="sc-phase sc-phase--2" style={{ borderLeftColor: '#6366f1' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#6366f1' }}>2</span>
          <span className="sc-phase-name">Teléfono de la empresa y extensiones</span>
        </div>

        <p className="sc-hint">
          Estos datos se insertan en <code>{'{telefonos_areas}'}</code>.
          Deja en blanco las extensiones que no apliquen.
        </p>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="mant-tel-empresa">Teléfono Principal de la Empresa</label>
          </div>
          <input
            id="mant-tel-empresa"
            type="tel"
            className="sc-tel-input"
            placeholder="Ej. 55 1234-5678"
            value={telEmpresa}
            onChange={e => { setTelEmpresa(e.target.value); setDirty(true); }}
          />
        </div>

        {areas.map(area => (
          <div className="setting-item sc-row" key={area.id}>
            <div className="setting-info">
              <label>Ext. {area.nombre_area}</label>
            </div>
            <input
              type="text"
              className="sc-tel-input"
              placeholder="Ej. 101"
              value={extensions[area.nombre_area] || ''}
              onChange={e => {
                setExtensions(prev => ({ ...prev, [area.nombre_area]: e.target.value }));
                setDirty(true);
              }}
            />
          </div>
        ))}
      </div>

      <div className="sc-footer">
        {isDirty && <span style={{ color: '#d97706', fontSize: '13px', fontWeight: '500', marginRight: 'auto' }}>
          ⚠️ Tienes cambios sin guardar. Haz clic en "Guardar cambios" para aplicarlos.
        </span>}
        <SectionStatus state={saveState} />
        <button
          className="btn-save"
          disabled={saveState === 'saving' || !isDirty}
          onClick={handleSave}
        >
          {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

const MantenimientoSection = (props) => {
  if (props.empresaId === 'todas') {
    return <MantenimientoGlobal {...props} />;
  }
  return <MantenimientoSingle {...props} />;
};

export default MantenimientoSection;
