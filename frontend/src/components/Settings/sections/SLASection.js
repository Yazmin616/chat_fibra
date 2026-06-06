import React, { useState } from 'react';
import {
  DEFAULTS, TimeField, SectionStatus,
  bestUnit, unitEquiv, useSectionSave,
} from '../settingsUtils';

/**
 * Sección: SLA de respuesta
 *
 * Controla dos umbrales independientes:
 *
 * 1. SLA del área (sla_area_min) — tiempo real sin que nadie tome el chat.
 *    Aplica en estado ESPERANDO_AGENTE. Al superarse se registra una infracción
 *    al equipo/área responsable. El cierre automático sigue siendo a las 24 h.
 *
 * 2. SLA del agente (sla_agente_nivel1_min) — minutos LABORALES sin responder
 *    al cliente mientras el chat está en ATENDIENDO. El reloj se pausa fuera
 *    del horario de jornada y se reinicia cuando el agente responde.
 */
const SLASection = ({ config, onSave, setDirty }) => {
  const [areaMin,  setAreaMin]  = useState(
    String(config.sla_area_min ?? DEFAULTS.sla_area_min)
  );
  const [unitArea, setUnitArea] = useState(() => bestUnit(areaMin).unit);

  const [nivel1Min, setNivel1Min] = useState(
    String(config.sla_agente_nivel1_min ?? DEFAULTS.sla_agente_nivel1_min)
  );
  const [unit1, setUnit1] = useState(() => bestUnit(nivel1Min).unit);

  const { saveState, runSave } = useSectionSave(setDirty);

  const nArea = parseInt(areaMin)   || 15;
  const n1    = parseInt(nivel1Min) || 30;

  const handleSave = () => runSave(onSave, [
    ['sla_area_min',          areaMin],
    ['sla_agente_nivel1_min', nivel1Min],
  ]);

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h">⏱</span> SLA de respuesta</h2>
        <p>
          Tiempos máximos antes de que se registre una infracción automática.
          Las infracciones son visibles solo para supervisores — no se notifica al cliente.
        </p>
      </div>

      {/* ── Línea de tiempo visual ─────────────────────────────────────────── */}
      <div className="sc-timeline">
        <div className="sc-step">
          <div className="sc-step-dot" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            1
          </div>
          <div className="sc-step-lbl">Infracción al área</div>
          <div className="sc-step-time" style={{ color: '#ef4444' }}>
            {unitEquiv(nArea)}
          </div>
        </div>
        <div className="sc-step-line" />
        <div className="sc-step">
          <div className="sc-step-dot" style={{ borderColor: '#f97316', color: '#f97316' }}>
            2
          </div>
          <div className="sc-step-lbl">Infracción al agente</div>
          <div className="sc-step-time" style={{ color: '#f97316' }}>
            {unitEquiv(n1)}
          </div>
        </div>
      </div>

      {/* ── SLA del área ──────────────────────────────────────────────────── */}
      <div className="sc-phase sc-phase--1">
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#ef4444' }}>1</span>
          <span className="sc-phase-name">Sin atender — Infracción al equipo</span>
        </div>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="sla-area-t">Registrar infracción después de</label>
            <span>
              Si ningún agente toma el chat en este tiempo, se registra una infracción
              al área responsable. Usa tiempo real (no laboral). El chat sigue abierto
              — el cierre automático ocurre a las 24 h.
            </span>
          </div>
          <TimeField
            id="sla-area-t"
            minutes={areaMin}
            unit={unitArea}
            onChangeMinutes={m => { setAreaMin(String(m)); setDirty(true); }}
            onChangeUnit={setUnitArea}
          />
        </div>
      </div>

      {/* ── SLA del agente ────────────────────────────────────────────────── */}
      <div className="sc-phase sc-phase--2">
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#f97316' }}>2</span>
          <span className="sc-phase-name">Sin seguimiento — Infracción al agente</span>
        </div>

        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="sla1-t">Registrar infracción después de</label>
            <span>
              Si el agente no responde al cliente en este tiempo laboral, se registra
              una infracción en su historial visible para el supervisor.
            </span>
          </div>
          <TimeField
            id="sla1-t"
            minutes={nivel1Min}
            unit={unit1}
            onChangeMinutes={m => { setNivel1Min(String(m)); setDirty(true); }}
            onChangeUnit={setUnit1}
          />
        </div>

        <div className="sc-alert sc-alert--info">
          ℹ️ El reloj inicia cuando el cliente escribe y el agente aún no ha respondido.
          Se pausa fuera de los turnos activos del área (configura los turnos en <strong>Turnos por área</strong>)
          y se cancela en cuanto el agente responde.
          Si el cliente escribe de nuevo después de una infracción, el reloj arranca desde cero.
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="sc-footer">
        <SectionStatus state={saveState} />
        <button
          className="btn-save"
          disabled={saveState === 'saving' || nArea < 1 || n1 < 1}
          onClick={handleSave}
        >
          {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

export default SLASection;
