import React, { useState } from 'react';
import {
  X, Plus, Trash2, MousePointer2, Info,
  MessageSquare, List, Clock, AlarmClock, GitBranch,
  Globe, Tag, Tags, MoveRight, Users, Bell,
  XCircle, Shield, Zap, Flag, Brain,
} from 'lucide-react';
import { TIPO_CONFIG } from './customNodes';
import { apiService } from '../../services/api';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function Field({ label, hint, children }) {
  return (
    <div className="fep-field">
      <label>
        {label}
        {hint && <span className="fep-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function FieldInput({ label, hint, value, onChange, placeholder, multiline, type = 'text', showVariables }) {
  const insertVariable = (variable) => {
    const textToInsert = `{{${variable}}}`;
    onChange((value || '') + textToInsert);
  };

  const VARIABLES_DISPONIBLES = [
    { label: '👤 Nombre', value: 'nombre' },
    { label: '🏢 Empresa', value: 'empresa' },
    { label: '📋 Servicio', value: 'servicio_etiqueta' },
    { label: '💵 Deuda', value: 'servicio_deuda' },
    { label: '📅 Vencimiento', value: 'servicio_vencimiento' },
    { label: '📶 Estado', value: 'servicio_estado' },
    { label: '🔗 Portal de Pago', value: 'servicio_portal_pago' },
    { label: '📍 Dirección', value: 'servicio_direccion' }
  ];

  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {showVariables && (
        <div className="fep-variables-picker">
          <span className="fep-variables-picker-title">Variables rápidas:</span>
          <div className="fep-variables-badges">
            {VARIABLES_DISPONIBLES.map(v => (
              <button
                key={v.value}
                type="button"
                className="fep-var-badge"
                onClick={() => insertVariable(v.value)}
                title={`Insertar ${v.label}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Field>
  );
}

function FieldSelect({ label, hint, value, onChange, children }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value || ''} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </Field>
  );
}

function OpcionesEditor({ opciones = [], onChange, isIntencion }) {
  const add    = () => onChange([...opciones, { texto: '', valor: isIntencion ? '' : `op_${Date.now()}` }]);
  const remove = (i) => onChange(opciones.filter((_, idx) => idx !== i));
  const update = (i, key, val) =>
    onChange(opciones.map((op, idx) => idx === i ? { ...op, [key]: val } : op));

  const [availableIntentions, setAvailableIntentions] = React.useState([
    'asesor', 'soporte', 'cobranza', 'ventas', 'menu'
  ]);

  React.useEffect(() => {
    if (isIntencion) {
      apiService.getPalabrasClave().then(data => {
        const custom = Array.from(new Set(data.map(d => d.intencion)));
        const all = Array.from(new Set(['asesor', 'soporte', 'cobranza', 'ventas', 'menu', ...custom]));
        setAvailableIntentions(all);
      }).catch(e => console.error(e));
    }
  }, [isIntencion]);

  return (
    <Field label="Opciones / botones" hint="Cada opción crea una salida">
      <div className="fep-options-list">
        {opciones.map((op, i) => (
          <div key={i} className="fep-option-row">
            <div className="fep-option-dot-line" />
            <div className="fep-option-inputs">
              <input
                value={op.texto || ''}
                placeholder={isIntencion ? "Nombre visual de la rama" : "Texto del botón"}
                onChange={e => update(i, 'texto', e.target.value)}
              />
              {isIntencion ? (
                <select
                  value={op.valor || ''}
                  className="fep-option-key"
                  onChange={e => update(i, 'valor', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                >
                  <option value="" disabled>Selecciona intención...</option>
                  {availableIntentions.map(int => (
                    <option key={int} value={int}>{int}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={op.valor || ''}
                  placeholder="clave_interna"
                  className="fep-option-key"
                  onChange={e => update(i, 'valor', e.target.value)}
                />
              )}
            </div>
            <button className="fep-option-remove" onClick={() => remove(i)} title="Eliminar">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button className="fep-add-btn" onClick={add}>
          <Plus size={13} /> Agregar opción
        </button>
      </div>
    </Field>
  );
}

/* ── Resumen (sin nodo seleccionado) ─────────────────────────────────────── */
function EmptyState({ nodes = [], edges = [] }) {
  const counts = {};
  nodes.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });

  return (
    <div className="fep-root fep-empty">
      <div className="fep-empty-header">
        <MousePointer2 size={15} />
        <span>Propiedades del nodo</span>
      </div>
      <div className="fep-empty-body">
        {nodes.length > 0 ? (
          <>
            <div className="fep-summary-title">Resumen del flujo</div>
            <div className="fep-summary-counters">
              <div className="fep-counter">
                <span className="fep-counter-num">{nodes.length}</span>
                <span className="fep-counter-lbl">nodos</span>
              </div>
              <div className="fep-counter-sep" />
              <div className="fep-counter">
                <span className="fep-counter-num">{edges.length}</span>
                <span className="fep-counter-lbl">conexiones</span>
              </div>
            </div>
            <div className="fep-breakdown">
              {Object.entries(counts).map(([tipo, cnt]) => {
                const cfg  = TIPO_CONFIG[tipo];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <div key={tipo} className="fep-breakdown-row">
                    <div className="fep-breakdown-icon" style={{ background: cfg.color }}>
                      <Icon size={11} strokeWidth={2} color="#fff" />
                    </div>
                    <span className="fep-breakdown-label">{cfg.label}</span>
                    <span className="fep-breakdown-count">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="fep-no-nodes">
            <Info size={20} strokeWidth={1.5} />
            <span>El flujo está vacío</span>
          </div>
        )}
        <div className="fep-hint-box">
          {[
            'Arrastra un tipo de nodo desde la paleta izquierda al canvas',
            'Conecta los nodos arrastrando desde el punto derecho al punto izquierdo',
            'Haz clic en cualquier nodo para editar su contenido aquí',
          ].map((txt, i) => (
            <div key={i} className="fep-hint-step">
              <span className="fep-hint-num">{i + 1}</span>
              {txt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Panel principal ─────────────────────────────────────────────────────── */
export default function EditPanel({ node, nodes, edges, onClose, onChange, onDelete }) {
  if (!node) return <EmptyState nodes={nodes} edges={edges} />;

  const tipo  = node.type;
  const datos = node.data || {};
  const cfg   = TIPO_CONFIG[tipo] || TIPO_CONFIG.mensaje;
  const Icon  = cfg.icon;

  const set = (key, val) => onChange({ ...datos, [key]: val });

  return (
    <div className="fep-root">
      {/* Header */}
      <div className="fep-header" style={{ background: cfg.color }}>
        <div className="fep-header-icon">
          <Icon size={16} strokeWidth={2} color="#fff" />
        </div>
        <div className="fep-header-text">
          <span className="fep-header-type">{cfg.label}</span>
          <span className="fep-header-name">{datos.label || cfg.label}</span>
        </div>
        <button className="fep-close-btn" onClick={onClose} title="Cerrar">
          <X size={15} color="#fff" />
        </button>
      </div>

      {/* Body */}
      <div className="fep-body">
        <FieldInput
          label="Nombre del nodo"
          hint="Visible en el canvas"
          value={datos.label}
          onChange={v => set('label', v)}
          placeholder={cfg.label}
        />

        {/* ── MENSAJE ── */}
        {tipo === 'mensaje' && (
          <FieldInput
            label="Texto del mensaje"
            hint="Contenido que verá el cliente"
            value={datos.texto}
            onChange={v => set('texto', v)}
            placeholder="Escribe el mensaje que enviará el bot..."
            multiline
            showVariables
          />
        )}

        {/* ── LISTA OPCIONES ── */}
        {tipo === 'lista_opciones' && (
          <>
            <FieldInput
              label="Texto de la pregunta"
              value={datos.texto}
              onChange={v => set('texto', v)}
              placeholder="¿En qué puedo ayudarte?"
              multiline
              showVariables
            />
            <OpcionesEditor
              opciones={datos.opciones || []}
              onChange={v => set('opciones', v)}
            />
          </>
        )}

        {/* ── ESPERAR ── */}
        {tipo === 'esperar' && (
          <FieldInput
            label="Segundos de espera"
            type="number"
            value={datos.segundos}
            onChange={v => set('segundos', v)}
            placeholder="5"
          />
        )}

        {/* ── ESPERAR MENSAJE ── */}
        {tipo === 'esperar_mensaje' && (
          <FieldInput
            label="Tiempo máximo (segundos)"
            hint="Si no responde, continúa"
            type="number"
            value={datos.timeout}
            onChange={v => set('timeout', v)}
            placeholder="120"
          />
        )}

        {/* ── CONDICIÓN ── */}
        {tipo === 'condicion' && (
          <>
            <FieldInput
              label="Campo a evaluar"
              hint="ej. cliente.estado"
              value={datos.campo}
              onChange={v => set('campo', v)}
              placeholder="cliente.estado"
            />
            <FieldInput
              label="Valor esperado"
              value={datos.valor}
              onChange={v => set('valor', v)}
              placeholder="activo"
            />
            <OpcionesEditor
              opciones={datos.opciones || []}
              onChange={v => set('opciones', v)}
            />
          </>
        )}

        {/* ── INTENCIÓN ── */}
        {tipo === 'intencion' && (
          <>
            <FieldInput
              label="Descripción"
              hint="Documentación interna"
              value={datos.descripcion}
              onChange={v => set('descripcion', v)}
              placeholder="Detecta intención de soporte / cobranza..."
              multiline
            />
            <OpcionesEditor
              opciones={datos.opciones || []}
              onChange={v => set('opciones', v)}
              isIntencion={true}
            />
          </>
        )}

        {/* ── API REQUEST ── */}
        {tipo === 'api_request' && (
          <>
            <FieldInput
              label="URL del endpoint"
              value={datos.url}
              onChange={v => set('url', v)}
              placeholder="https://api.ejemplo.com/consulta"
              showVariables
            />
            <FieldSelect
              label="Método HTTP"
              value={datos.metodo || 'GET'}
              onChange={v => set('metodo', v)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </FieldSelect>
            <FieldInput
              label="Body (JSON)"
              hint="Solo para POST/PUT"
              value={datos.body}
              onChange={v => set('body', v)}
              placeholder='{"clave": "valor"}'
              multiline
              showVariables
            />
          </>
        )}

        {/* ── ETIQUETAR / DESETIQUETAR ── */}
        {(tipo === 'etiquetar' || tipo === 'desetiquetar') && (
          <FieldInput
            label="Nombre de la etiqueta"
            value={datos.etiqueta}
            onChange={v => set('etiqueta', v)}
            placeholder="VIP, pendiente-pago, etc."
          />
        )}

        {/* ── MOVER ETAPA ── */}
        {tipo === 'mover_etapa' && (
          <FieldInput
            label="Nombre de la etapa destino"
            value={datos.etapa}
            onChange={v => set('etapa', v)}
            placeholder="Calificado, Cerrado, etc."
          />
        )}

        {/* ── ASIGNAR EQUIPO ── */}
        {tipo === 'asignar_equipo' && (
          <>
            <FieldSelect
              label="Equipo / Área"
              value={datos.equipo}
              onChange={v => set('equipo', v)}
            >
              <option value="">— Seleccionar —</option>
              <option value="Soporte Técnico">Soporte Técnico</option>
              <option value="Cobranza">Cobranza</option>
              <option value="Ventas">Ventas</option>
            </FieldSelect>
            <FieldInput
              label="Mensaje de confirmación"
              hint="Texto que verá el cliente"
              value={datos.mensaje}
              onChange={v => set('mensaje', v)}
              placeholder="Te conectamos con un asesor..."
              multiline
              showVariables
            />
          </>
        )}

        {/* ── ACCIÓN (legado) ── */}
        {tipo === 'accion' && (
          <>
            <FieldSelect
              label="Tipo de acción"
              value={datos.accion || 'escalar_agente'}
              onChange={v => set('accion', v)}
            >
              <option value="escalar_agente">Escalar a agente humano</option>
              <option value="identificar_cliente">Identificar cliente (WISP)</option>
              <option value="mostrar_deuda">Mostrar deuda</option>
              <option value="mostrar_pago">Mostrar formas de pago</option>
            </FieldSelect>
            <FieldInput
              label="Mensaje de confirmación"
              value={datos.mensaje}
              onChange={v => set('mensaje', v)}
              placeholder="Te conectamos con un asesor..."
              multiline
            />
          </>
        )}

        {/* ── FIN ── */}
        {tipo === 'fin' && (
          <FieldInput
            label="Descripción"
            hint="Estado final"
            value={datos.descripcion}
            onChange={v => set('descripcion', v)}
            placeholder="Conversación cerrada..."
          />
        )}

        {/* ── VALIDAR BANXICO ── */}
        {tipo === 'validar_banxico' && (
          <FieldInput
            label="Variable de comprobante"
            hint="Campo donde está el CLABE/referencia"
            value={datos.variable}
            onChange={v => set('variable', v)}
            placeholder="{{comprobante_clabe}}"
          />
        )}

        {/* ── NOTIFICACIÓN CHAT ── */}
        {tipo === 'notificacion_chat' && (
          <FieldInput
            label="Texto de la notificación"
            value={datos.texto}
            onChange={v => set('texto', v)}
            placeholder="Cliente esperando en cola..."
            multiline
          />
        )}

        {/* ── Eliminar nodo ── */}
        <div className="fep-footer">
          <button className="fep-delete-btn" onClick={() => onDelete(node.id)}>
            <Trash2 size={14} /> Eliminar nodo
          </button>
        </div>
      </div>
    </div>
  );
}
