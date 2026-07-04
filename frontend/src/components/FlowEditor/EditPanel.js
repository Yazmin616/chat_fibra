import React from 'react';
import {
  X, Plus, Trash2,
  MessageSquare, HelpCircle, GitBranch, Zap, Brain, Flag,
  MousePointer2, Info,
} from 'lucide-react';
import { TIPO_CONFIG } from './customNodes';

const TIPO_ICONS = {
  mensaje: MessageSquare, pregunta: HelpCircle, condicion: GitBranch,
  accion:  Zap,          intencion: Brain,      fin:       Flag,
};
const TIPO_ORDEN = ['mensaje', 'pregunta', 'condicion', 'accion', 'intencion', 'fin'];

/* ── Field helpers ───────────────────────────────────────────────────────── */
function Field({ label, hint, children }) {
  return (
    <div className="flow-field">
      <label>
        {label}
        {hint && <span className="flow-field-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function FieldInput({ label, hint, value, onChange, placeholder, multiline }) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}

function OpcionesEditor({ opciones = [], onChange }) {
  const add    = () => onChange([...opciones, { texto: '', valor: '' }]);
  const remove = (i) => onChange(opciones.filter((_, idx) => idx !== i));
  const update = (i, key, val) =>
    onChange(opciones.map((op, idx) => idx === i ? { ...op, [key]: val } : op));

  return (
    <Field label="Opciones / botones" hint="Cada opción crea una salida en el nodo">
      <div className="flow-options-list">
        {opciones.map((op, i) => (
          <div key={i} className="flow-option-row">
            <input
              value={op.texto || ''}
              placeholder="Texto del botón"
              onChange={e => update(i, 'texto', e.target.value)}
            />
            <input
              value={op.valor || ''}
              placeholder="clave"
              className="flow-option-key"
              onChange={e => update(i, 'valor', e.target.value)}
            />
            <button className="flow-option-remove" onClick={() => remove(i)} title="Eliminar opción">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button className="flow-add-option-btn" onClick={add}>
          <Plus size={13} /> Agregar opción
        </button>
      </div>
    </Field>
  );
}

function AccionSelect({ value, onChange }) {
  return (
    <Field label="Tipo de acción">
      <select value={value || 'escalar_agente'} onChange={e => onChange(e.target.value)}>
        <option value="escalar_agente">Escalar a agente humano</option>
        <option value="identificar_cliente">Identificar cliente (BD)</option>
        <option value="mostrar_deuda">Mostrar deuda</option>
        <option value="mostrar_pago">Mostrar formas de pago</option>
      </select>
    </Field>
  );
}

/* ── Empty state: resumen del flujo ─────────────────────────────────────── */
function EmptyState({ nodes = [], edges = [] }) {
  const total = nodes.length;
  const counts = TIPO_ORDEN.reduce((acc, t) => {
    acc[t] = nodes.filter(n => n.type === t).length;
    return acc;
  }, {});
  const hasNodes = total > 0;

  return (
    <div className="flow-edit-panel">
      <div className="flow-edit-panel-empty-header">
        <MousePointer2 size={16} color="#64748b" />
        <span>Propiedades del nodo</span>
      </div>

      <div className="flow-edit-panel-empty-body">
        {hasNodes ? (
          <>
            <div className="flow-empty-summary-title">Resumen del flujo</div>
            <div className="flow-empty-counts-row">
              <span className="flow-empty-total">{total}</span>
              <span className="flow-empty-total-label">nodos</span>
              <span className="flow-empty-sep">·</span>
              <span className="flow-empty-total">{edges.length}</span>
              <span className="flow-empty-total-label">conexiones</span>
            </div>

            <div className="flow-empty-breakdown">
              {TIPO_ORDEN.map(tipo => {
                if (!counts[tipo]) return null;
                const cfg  = TIPO_CONFIG[tipo];
                const Icon = TIPO_ICONS[tipo];
                return (
                  <div key={tipo} className="flow-empty-type-row">
                    <div
                      className="flow-node-icon"
                      style={{ background: cfg.color, width: 20, height: 20, borderRadius: 4, flexShrink: 0 }}
                    >
                      <Icon size={11} strokeWidth={2} />
                    </div>
                    <span className="flow-empty-type-name">{cfg.label}</span>
                    <span className="flow-empty-type-count">{counts[tipo]}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flow-empty-no-nodes">
            <Info size={18} color="#cbd5e1" strokeWidth={1.5} />
            <span>El flujo está vacío</span>
          </div>
        )}

        <div className="flow-empty-hint">
          <div className="flow-empty-hint-step">
            <span className="flow-empty-hint-num">1</span>
            Arrastra un tipo de nodo desde la paleta izquierda al canvas
          </div>
          <div className="flow-empty-hint-step">
            <span className="flow-empty-hint-num">2</span>
            Conecta los nodos arrastrando desde el punto inferior al punto superior
          </div>
          <div className="flow-empty-hint-step">
            <span className="flow-empty-hint-num">3</span>
            Haz clic en cualquier nodo para editar su contenido aquí
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Panel con nodo seleccionado ─────────────────────────────────────────── */
export default function EditPanel({ node, nodes, edges, onClose, onChange, onDelete }) {
  if (!node) return <EmptyState nodes={nodes} edges={edges} />;

  const tipo  = node.type;
  const datos = node.data || {};
  const cfg   = TIPO_CONFIG[tipo] || TIPO_CONFIG.mensaje;
  const Icon  = TIPO_ICONS[tipo]  || MessageSquare;

  const set = (key, val) => onChange({ ...datos, [key]: val });

  return (
    <div className="flow-edit-panel">
      {/* Header coloreado según tipo */}
      <div
        className="flow-edit-panel-header"
        style={{ background: cfg.lightBg, borderBottomColor: cfg.border }}
      >
        <div
          className="flow-node-icon"
          style={{ background: cfg.color, width: 30, height: 30, borderRadius: 7, flexShrink: 0 }}
        >
          <Icon size={15} strokeWidth={2} />
        </div>
        <div className="flow-edit-panel-header-text">
          <span className="flow-edit-type-badge" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <h3 className="flow-edit-node-name">
            {datos.label || cfg.label}
          </h3>
        </div>
        <button className="flow-edit-close-btn" onClick={onClose} title="Cerrar panel">
          <X size={16} />
        </button>
      </div>

      <div className="flow-edit-panel-body">
        <FieldInput
          label="Nombre del nodo"
          hint="Visible en el canvas"
          value={datos.label}
          onChange={v => set('label', v)}
          placeholder={cfg.label}
        />

        {tipo === 'mensaje' && (
          <FieldInput
            label="Texto del mensaje"
            hint="Contenido que verá el cliente"
            value={datos.texto}
            onChange={v => set('texto', v)}
            placeholder="Escribe el mensaje que enviará el bot..."
            multiline
          />
        )}

        {tipo === 'pregunta' && (
          <>
            <FieldInput
              label="Texto de la pregunta"
              value={datos.texto}
              onChange={v => set('texto', v)}
              placeholder="¿En qué puedo ayudarte?"
              multiline
            />
            <OpcionesEditor
              opciones={datos.opciones || []}
              onChange={v => set('opciones', v)}
            />
          </>
        )}

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
              hint="Comparación exacta"
              value={datos.valor}
              onChange={v => set('valor', v)}
              placeholder="activo"
            />
          </>
        )}

        {tipo === 'accion' && (
          <>
            <AccionSelect value={datos.accion} onChange={v => set('accion', v)} />
            {datos.accion === 'escalar_agente' && (
              <FieldInput
                label="Departamento destino"
                value={datos.departamento}
                onChange={v => set('departamento', v)}
                placeholder="Soporte Técnico"
              />
            )}
            <FieldInput
              label="Mensaje de confirmación"
              hint="Texto al cliente al ejecutar"
              value={datos.mensaje}
              onChange={v => set('mensaje', v)}
              placeholder="Te conectamos con un asesor..."
              multiline
            />
          </>
        )}

        {tipo === 'intencion' && (
          <FieldInput
            label="Descripción"
            hint="Documentación interna"
            value={datos.descripcion}
            onChange={v => set('descripcion', v)}
            placeholder="Detecta intención de soporte / cobranza / ventas por palabras clave del cliente..."
            multiline
          />
        )}

        {tipo === 'fin' && (
          <FieldInput
            label="Descripción"
            hint="Estado final de la conversación"
            value={datos.descripcion}
            onChange={v => set('descripcion', v)}
            placeholder="Conversación cerrada / en espera de agente..."
          />
        )}

        <div className="flow-edit-panel-footer">
          <button
            className="flow-btn flow-btn-danger"
            style={{ width: '100%' }}
            onClick={() => onDelete(node.id)}
          >
            <Trash2 size={14} /> Eliminar nodo
          </button>
        </div>
      </div>
    </div>
  );
}
