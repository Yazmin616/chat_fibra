import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, XCircle } from 'lucide-react';
import {
  DEFAULTS, TimeField, MessageField, SectionStatus,
  bestUnit, unitEquiv, useSectionSave,
} from '../settingsUtils';

/**
 * Sección: Inactividad en atención humana
 * Escalada escalonada de 3 fases cuando el cliente deja de responder a un agente.
 */
const InactividadHumanaSection = ({ config, onSave, setDirty }) => {

  // ── Estado local (inicializado desde config) ─────────────────────────────
  const [a1Min,    setA1Min]    = useState(String(config.inactividad_aviso1_min ?? DEFAULTS.inactividad_aviso1_min));
  const [a2Min,    setA2Min]    = useState(String(config.inactividad_aviso2_min ?? DEFAULTS.inactividad_aviso2_min));
  const [acMin,    setAcMin]    = useState(String(config.inactividad_cierre_min ?? DEFAULTS.inactividad_cierre_min));
  const [msgA1,    setMsgA1]    = useState(config.inactividad_msg_aviso1 ?? DEFAULTS.inactividad_msg_aviso1);
  const [msgA2,    setMsgA2]    = useState(config.inactividad_msg_aviso2 ?? DEFAULTS.inactividad_msg_aviso2);
  const [msgCierre,setMsgCierre]= useState(config.inactividad_msg_cierre ?? DEFAULTS.inactividad_msg_cierre);

  const [unitA1, setUnitA1] = useState(() => bestUnit(a1Min).unit);
  const [unitA2, setUnitA2] = useState(() => bestUnit(a2Min).unit);
  const [unitAc, setUnitAc] = useState(() => bestUnit(acMin).unit);

  const { saveState, runSave } = useSectionSave(setDirty);

  const mark = (setter) => (val) => { setter(val); setDirty(true); };

  // ── Validaciones ──────────────────────────────────────────────────────────
  const n1 = parseInt(a1Min) || 30;
  const n2 = parseInt(a2Min) || 120;
  const nc = parseInt(acMin) || 240;
  const orderOk = n1 < n2 && n2 < nc;
  const waWarn  = nc > 720 && nc < 1440;
  const waError = nc >= 1440;

  const saveDisabled = saveState === 'saving' || !orderOk || waError;

  const handleSave = () => runSave(onSave, [
    ['inactividad_aviso1_min', a1Min],
    ['inactividad_aviso2_min', a2Min],
    ['inactividad_cierre_min', acMin],
    ['inactividad_msg_aviso1', msgA1],
    ['inactividad_msg_aviso2', msgA2],
    ['inactividad_msg_cierre', msgCierre],
  ]);

  return (
    <div className="cfg-section-wrap">
      <div className="cfg-section-header">
        <h2><span className="cfg-section-icon-h"><MessageSquare size={20} /></span> Inactividad en atención humana</h2>
        <p>
          Escalada cuando el <strong>cliente</strong> deja de responder a un agente.
          El temporizador se reinicia cada vez que el cliente escribe.{' '}
          <span style={{ color: '#667781' }}>
            Para WhatsApp, todo el ciclo debe completarse dentro de las 24 h de la ventana de Meta.
          </span>
        </p>
      </div>

      {/* ── Línea de tiempo visual ─────────────────────────────────────────── */}
      <div className="sc-timeline">
        {[
          { n: 1, label: 'Recordatorio', mins: n1, color: '#2563eb' },
          { n: 2, label: 'Aviso cierre',  mins: n2, color: '#d97706' },
          { n: 3, label: 'Cierre',         mins: nc, color: '#dc2626' },
        ].map((step, i, arr) => (
          <React.Fragment key={step.n}>
            <div className="sc-step">
              <div className="sc-step-dot" style={{ borderColor: step.color, color: step.color }}>
                {step.n}
              </div>
              <div className="sc-step-lbl">{step.label}</div>
              <div className="sc-step-time" style={{ color: step.color }}>{unitEquiv(step.mins)}</div>
            </div>
            {i < arr.length - 1 && (
              <div className={`sc-step-line${orderOk ? '' : ' sc-step-line--err'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Alertas ───────────────────────────────────────────────────────── */}
      {!orderOk && (
        <div className="sc-alert sc-alert--err">
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} /> El orden debe ser: Recordatorio &lt; Aviso de cierre &lt; Cierre automático.
        </div>
      )}
      {waError && (
        <div className="sc-alert sc-alert--err">
          <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} /> El cierre supera las 24 h. WhatsApp no permite mensajes fuera de la ventana de Meta sin plantilla aprobada.
        </div>
      )}
      {waWarn && (
        <div className="sc-alert sc-alert--warn">
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} /> El cierre supera las 12 h. Verifica que sea correcto para la ventana de 24 h de WhatsApp.
        </div>
      )}

      {/* ── Fase 1: Recordatorio suave ─────────────────────────────────────── */}
      <div className="sc-phase sc-phase--1">
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#2563eb' }}>1</span>
          <span className="sc-phase-name">Recordatorio suave</span>
        </div>
        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="a1-t">Enviar después de</label>
            <span>Mensaje amigable para verificar si el cliente sigue disponible.</span>
          </div>
          <TimeField id="a1-t" minutes={a1Min} unit={unitA1}
            onChangeMinutes={m => { setA1Min(String(m)); setDirty(true); }}
            onChangeUnit={setUnitA1}
          />
        </div>
        <MessageField id="a1-msg" value={msgA1} onChange={mark(setMsgA1)} />
      </div>

      {/* ── Fase 2: Aviso de cierre ────────────────────────────────────────── */}
      <div className="sc-phase sc-phase--2">
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#d97706' }}>2</span>
          <span className="sc-phase-name">Aviso de cierre próximo</span>
        </div>
        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="a2-t">Enviar después de</label>
            <span>Notifica al cliente que la conversación se cerrará si no hay respuesta.</span>
          </div>
          <TimeField id="a2-t" minutes={a2Min} unit={unitA2}
            onChangeMinutes={m => { setA2Min(String(m)); setDirty(true); }}
            onChangeUnit={setUnitA2}
          />
        </div>
        <MessageField id="a2-msg" value={msgA2} onChange={mark(setMsgA2)} />
      </div>

      {/* ── Fase 3: Cierre automático ─────────────────────────────────────── */}
      <div className="sc-phase sc-phase--3">
        <div className="sc-phase-head">
          <span className="sc-phase-num" style={{ background: '#dc2626' }}>3</span>
          <span className="sc-phase-name">Cierre automático + encuesta CSAT</span>
        </div>
        <div className="setting-item sc-row">
          <div className="setting-info">
            <label htmlFor="ac-t">Cerrar conversación después de</label>
            <span>Libera al agente y envía la encuesta de satisfacción al cliente.</span>
          </div>
          <TimeField id="ac-t" minutes={acMin} unit={unitAc}
            onChangeMinutes={m => { setAcMin(String(m)); setDirty(true); }}
            onChangeUnit={setUnitAc}
          />
        </div>
        <MessageField id="ac-msg" value={msgCierre} onChange={mark(setMsgCierre)} />
      </div>

      {/* ── Footer con botón único ─────────────────────────────────────────── */}
      <div className="sc-footer">
        <SectionStatus state={saveState} />
        <button className="btn-save" disabled={saveDisabled} onClick={handleSave}>
          {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
};

export default InactividadHumanaSection;
