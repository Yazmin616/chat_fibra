import React, { useState } from 'react';
import { Wrench, Info, Briefcase, DollarSign } from 'lucide-react';
import { MessageField, SectionStatus, useSectionSave } from '../settingsUtils';

const TELEFONO_DEFAULT = '';

const MantenimientoSection = ({ config, onSave, setDirty }) => {
  const [msg,         setMsg]        = useState(config.msg_mantenimiento ?? '');
  const [telSoporte,  setTelSoporte] = useState(config.tel_soporte      ?? TELEFONO_DEFAULT);
  const [telVentas,   setTelVentas]  = useState(config.tel_ventas       ?? TELEFONO_DEFAULT);
  const [telCobranza, setTelCobranza]= useState(config.tel_cobranza     ?? TELEFONO_DEFAULT);

  const { saveState, runSave } = useSectionSave(setDirty);

  const handleSave = () => runSave(onSave, [
    ['msg_mantenimiento', msg],
    ['tel_soporte',       telSoporte],
    ['tel_ventas',        telVentas],
    ['tel_cobranza',      telCobranza],
  ]);

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

      {/* ── Mensaje al cliente ──────────────────────────────────────────────── */}
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

        <MessageField
          id="mant-msg"
          value={msg}
          onChange={dirty(msg, setMsg)}
        />
      </div>

      {/* ── Teléfonos de contacto ───────────────────────────────────────────── */}
      <div className="sc-phase sc-phase--2" style={{ borderLeftColor: '#6366f1' }}>
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#6366f1' }}>2</span>
          <span className="sc-phase-name">Teléfonos de contacto por área</span>
        </div>

        <p className="sc-hint">
          Estos números se insertan en <code>{'{telefonos_areas}'}</code>.
          Deja en blanco las áreas que no apliquen.
        </p>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="mant-tel-soporte"><Wrench size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Soporte Técnico</label>
          </div>
          <input
            id="mant-tel-soporte"
            type="tel"
            className="sc-tel-input"
            placeholder="Ej. 55 1234-5678"
            value={telSoporte}
            onChange={e => { setTelSoporte(e.target.value); setDirty(true); }}
          />
        </div>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="mant-tel-ventas"><Briefcase size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ventas</label>
          </div>
          <input
            id="mant-tel-ventas"
            type="tel"
            className="sc-tel-input"
            placeholder="Ej. 55 1234-5679"
            value={telVentas}
            onChange={e => { setTelVentas(e.target.value); setDirty(true); }}
          />
        </div>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="mant-tel-cobranza"><DollarSign size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Cobranza</label>
          </div>
          <input
            id="mant-tel-cobranza"
            type="tel"
            className="sc-tel-input"
            placeholder="Ej. 55 1234-5680"
            value={telCobranza}
            onChange={e => { setTelCobranza(e.target.value); setDirty(true); }}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="sc-footer">
        <SectionStatus state={saveState} />
        <button
          className="btn-save"
          disabled={saveState === 'saving'}
          onClick={handleSave}
        >
          {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

export default MantenimientoSection;
