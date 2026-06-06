/**
 * @file settingsUtils.js
 * @description Utilidades compartidas y sub-componentes reutilizables
 * para todas las secciones del panel de configuración.
 */
import React, { useCallback, useState } from 'react';

// ── Conversión de tiempo ──────────────────────────────────────────────────────

export function bestUnit(minutes) {
  const m = parseInt(minutes) || 0;
  if (m > 0 && m % 1440 === 0) return { val: m / 1440, unit: 'dias' };
  if (m > 0 && m % 60 === 0)   return { val: m / 60,   unit: 'horas' };
  return { val: m, unit: 'min' };
}

export function toMinutes(val, unit) {
  const n = parseFloat(val) || 0;
  if (unit === 'horas') return Math.max(1, Math.round(n * 60));
  if (unit === 'dias')  return Math.max(1, Math.round(n * 1440));
  return Math.max(1, Math.round(n));
}

export function toDisplay(minutes, unit) {
  const m = parseInt(minutes) || 0;
  if (unit === 'horas') { const h = m / 60; return Number.isInteger(h) ? String(h) : h.toFixed(1); }
  if (unit === 'dias')  { const d = m / 1440; return Number.isInteger(d) ? String(d) : d.toFixed(1); }
  return String(m);
}

export function unitEquiv(min) {
  const m = parseInt(min) || 0;
  if (m === 0) return '—';
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} día${m / 1440 !== 1 ? 's' : ''}`;
  if (m >= 60)  return `${m / 60 % 1 === 0 ? m / 60 : (m / 60).toFixed(1)} h (${m} min)`;
  return `${m} min`;
}

// ── Variables de plantilla ────────────────────────────────────────────────────

export const VARS = [
  { key: '{nombre_cliente}',   demo: 'Carlos López'                     },
  { key: '{area}',             demo: 'Soporte Técnico'                  },
  { key: '{empresa}',          demo: 'Fibratec'                         },
  { key: '{nombre_agente}',    demo: 'María García'                     },
  { key: '{horarios_atencion}',demo: 'Lun-Vie 9am-6pm, Sáb 9am-8pm'   },
  { key: '{proximo_dia_habil}',demo: 'lunes 9/6'                        },
];

export function applyVars(text) {
  let r = text || '';
  VARS.forEach(v => { r = r.replace(new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g'), v.demo); });
  return r;
}

// ── Valores por defecto ───────────────────────────────────────────────────────

export const DEFAULTS = {
  tiempo_inactividad:     '10',
  inactividad_aviso1_min: '30',
  inactividad_aviso2_min: '120',
  inactividad_cierre_min: '240',
  inactividad_msg_aviso1: '¿Sigues ahí? 👋 Seguimos disponibles para ayudarte cuando quieras.',
  inactividad_msg_aviso2: 'Hola, si no continúas la conversación la cerraremos pronto. ¡Escríbenos cuando quieras! 😊',
  inactividad_msg_cierre: '¿Cómo calificarías la atención de {nombre_agente} hoy? 🌟\n\n1️⃣  Mala\n2️⃣  Regular\n3️⃣  Buena\n\nEscribe el número de tu calificación.',
  jornada_inicio: '09:00',
  jornada_fin:    '18:00',
  jornada_dias:   '1,2,3,4,5',
  // SLA del área — tiempo real máximo sin que ningún agente tome el chat
  sla_area_min:          '15',
  // SLA del agente — tiempo laboral máximo para responder antes de generar infracción
  sla_agente_nivel1_min: '30',
  // Mensajes automáticos de horario (escenarios A y B)
  msg_festivo:          '¡Hola! 👋 Hoy es día festivo en {empresa}. El equipo de {area} retoma actividades el {proximo_dia_habil}. Disculpa el inconveniente — escríbenos entonces y te atenderemos con gusto.\n\n🕐 Horarios habituales:\n{horarios_atencion}',
  msg_fuera_horario:    '¡Hola! 👋 Gracias por contactar a {empresa}. En este momento el equipo de {area} no está disponible.\n\n🕐 Horarios de atención:\n{horarios_atencion}\n\nTu mensaje quedó registrado y te responderemos en cuanto retomemos actividades. ¡Hasta pronto!',
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

export function TimeField({ id, minutes, unit, onChangeMinutes, onChangeUnit }) {
  return (
    <div className="sc-time-field">
      <div className="sc-time-row">
        <input
          id={id}
          type="number"
          min="1"
          step="1"
          className="sc-time-number"
          value={toDisplay(minutes, unit)}
          onChange={e => onChangeMinutes(toMinutes(e.target.value, unit))}
        />
        <select
          className="sc-unit-select"
          value={unit}
          onChange={e => onChangeUnit(e.target.value)}
        >
          <option value="min">minutos</option>
          <option value="horas">horas</option>
          <option value="dias">días</option>
        </select>
      </div>
      <span className="sc-equiv">{unitEquiv(minutes)}</span>
    </div>
  );
}

export function MessageField({ id, value, onChange }) {
  const [editing, setEditing] = useState(false);

  const insertVar = useCallback((varKey) => {
    const el = document.getElementById(id);
    if (el) {
      const s = el.selectionStart ?? (value || '').length;
      const e = el.selectionEnd   ?? s;
      onChange((value || '').slice(0, s) + varKey + (value || '').slice(e));
      setTimeout(() => { el.focus(); el.setSelectionRange(s + varKey.length, s + varKey.length); }, 0);
    } else {
      onChange((value || '') + varKey);
    }
  }, [id, value, onChange]);

  return (
    <div className="sc-msg-field">
      <div className="sc-msg-header">
        <span className="sc-msg-label">Mensaje al cliente</span>
        <button type="button" className="sc-preview-btn" onClick={() => setEditing(v => !v)}>
          {editing ? '👁 Vista previa' : '✏️ Editar'}
        </button>
      </div>
      {editing ? (
        <>
          <textarea
            id={id}
            className="sc-msg-textarea"
            rows={3}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Escribe el mensaje que recibirá el cliente…"
          />
          <div className="sc-vars-bar">
            <span className="sc-vars-label">Insertar:</span>
            {VARS.map(v => (
              <button key={v.key} type="button" className="sc-var-chip"
                title={`Ejemplo: "${v.demo}"`} onClick={() => insertVar(v.key)}>
                {v.key}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="sc-preview-wrap">
          <div className="sc-preview-bubble">{applyVars(value)}</div>
          <p className="sc-preview-note">Vista previa con datos de ejemplo</p>
        </div>
      )}
    </div>
  );
}

export function SectionStatus({ state }) {
  if (state === 'saving') return <span className="sc-status sc-status--saving">Guardando…</span>;
  if (state === 'saved')  return <span className="sc-status sc-status--ok">✓ Guardado</span>;
  if (state === 'error')  return <span className="sc-status sc-status--err">✗ Error al guardar</span>;
  return null;
}

/**
 * Hook que centraliza el estado save + lógica de dirty tracking para cada sección.
 * @param {Function} setDirty - Setter de dirty del shell padre.
 */
export function useSectionSave(setDirty) {
  const [saveState, setSaveState] = useState('idle');

  const runSave = useCallback(async (onSave, pairs) => {
    setSaveState('saving');
    try {
      for (const [k, v] of pairs) await onSave(k, String(v));
      setDirty(false);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }, [setDirty]);

  return { saveState, runSave };
}
