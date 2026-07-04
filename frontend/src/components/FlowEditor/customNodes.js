import React from 'react';
import { Handle, Position } from 'reactflow';
import { MessageSquare, HelpCircle, GitBranch, Zap, Brain, Flag } from 'lucide-react';

export const TIPO_CONFIG = {
  mensaje: {
    icon: MessageSquare, label: 'Mensaje',   cls: 'mensaje',
    desc: 'Envía texto al cliente',
    color: '#4f46e5', lightBg: '#eef2ff', border: '#a5b4fc', ring: 'rgba(99,102,241,0.2)',
  },
  pregunta: {
    icon: HelpCircle,    label: 'Pregunta',  cls: 'pregunta',
    desc: 'Presenta opciones al cliente',
    color: '#16a34a', lightBg: '#f0fdf4', border: '#86efac', ring: 'rgba(22,163,74,0.2)',
  },
  condicion: {
    icon: GitBranch,     label: 'Condición', cls: 'condicion',
    desc: 'Bifurca según una condición',
    color: '#d97706', lightBg: '#fffbeb', border: '#fcd34d', ring: 'rgba(217,119,6,0.2)',
  },
  accion: {
    icon: Zap,           label: 'Acción',    cls: 'accion',
    desc: 'Ejecuta una acción del sistema',
    color: '#dc2626', lightBg: '#fff1f2', border: '#fca5a5', ring: 'rgba(220,38,38,0.2)',
  },
  intencion: {
    icon: Brain,         label: 'Intención', cls: 'intencion',
    desc: 'Detecta intención por texto libre',
    color: '#7c3aed', lightBg: '#faf5ff', border: '#c4b5fd', ring: 'rgba(124,58,237,0.2)',
  },
  fin: {
    icon: Flag,          label: 'Fin',       cls: 'fin',
    desc: 'Cierra la conversación',
    color: '#475569', lightBg: '#f1f5f9', border: '#cbd5e1', ring: 'rgba(71,85,105,0.2)',
  },
};

function FlowNode({ data, selected, tipo }) {
  const cfg    = TIPO_CONFIG[tipo] || TIPO_CONFIG.mensaje;
  const Icon   = cfg.icon;
  const preview = data.texto || data.descripcion || data.accion || null;
  const opciones = data.opciones || [];

  return (
    <div
      className={`flow-node flow-node-${cfg.cls}${selected ? ' selected' : ''}`}
      style={selected ? {
        borderColor: cfg.color,
        boxShadow: `0 0 0 3px ${cfg.ring}, 0 4px 16px rgba(0,0,0,0.12)`,
      } : undefined}
    >
      <Handle type="target" position={Position.Top} id="in" className="flow-handle" />

      <div className="flow-node-top">
        <div
          className="flow-node-icon"
          style={{ background: cfg.color }}
        >
          <Icon size={14} strokeWidth={2} />
        </div>
        <div className="flow-node-titles">
          <span className="flow-node-type" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="flow-node-label">
            {data.label || cfg.label}
          </span>
        </div>
      </div>

      {preview && (
        <div className="flow-node-preview">{preview}</div>
      )}

      {tipo === 'pregunta' && opciones.length > 0 && (
        <div className="flow-node-chips">
          {opciones.slice(0, 3).map((op, i) => (
            <span key={i} className="flow-node-chip">
              {op.texto || op.valor || `Opción ${i + 1}`}
            </span>
          ))}
          {opciones.length > 3 && (
            <span className="flow-node-chip flow-node-chip-more">
              +{opciones.length - 3}
            </span>
          )}
        </div>
      )}

      {tipo === 'pregunta' && opciones.length > 0 ? (
        opciones.map((op, i) => (
          <Handle
            key={op.valor || i}
            type="source"
            position={Position.Bottom}
            id={op.valor || String(i)}
            className="flow-handle"
            style={{ left: `${((i + 1) / (opciones.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Bottom} id="out" className="flow-handle" />
      )}
    </div>
  );
}

export const MensajeNode   = (p) => <FlowNode {...p} tipo="mensaje"   />;
export const PreguntaNode  = (p) => <FlowNode {...p} tipo="pregunta"  />;
export const CondicionNode = (p) => <FlowNode {...p} tipo="condicion" />;
export const AccionNode    = (p) => <FlowNode {...p} tipo="accion"    />;
export const IntencionNode = (p) => <FlowNode {...p} tipo="intencion" />;
export const FinNode       = (p) => <FlowNode {...p} tipo="fin"       />;

export const nodeTypes = {
  mensaje:   MensajeNode,
  pregunta:  PreguntaNode,
  condicion: CondicionNode,
  accion:    AccionNode,
  intencion: IntencionNode,
  fin:       FinNode,
};
