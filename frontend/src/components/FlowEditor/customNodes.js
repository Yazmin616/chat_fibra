import React from 'react';
import { Handle, Position } from 'reactflow';
import {
  MessageSquare, List, Clock, AlarmClock, GitBranch,
  Globe, Tag, Tags, MoveRight, Users, Bell,
  Trash2, XCircle, Shield, Zap, Flag, Brain,
} from 'lucide-react';

/**
 * Catálogo de tipos de nodo disponibles en el editor.
 * Cada tipo define: icono, etiqueta, descripción, color de cabecera,
 * y categoría (para agrupar en la paleta).
 */
export const TIPO_CONFIG = {
  // ── Mensajería ──────────────────────────────────────────
  mensaje: {
    icon: MessageSquare, label: 'Mensaje',
    desc: 'Envía mensaje al cliente',
    color: '#0d9488', headerBg: '#0d9488', bodyBg: '#fff',
    border: '#0d9488', cat: 'Mensajería',
  },
  lista_opciones: {
    icon: List, label: 'Lista de opciones',
    desc: 'Muestra opciones al usuario',
    color: '#0d9488', headerBg: '#0d9488', bodyBg: '#fff',
    border: '#0d9488', cat: 'Mensajería',
  },

  // ── Lógica de flujo ─────────────────────────────────────
  esperar: {
    icon: Clock, label: 'Esperar',
    desc: 'Pausa el flujo un tiempo',
    color: '#f59e0b', headerBg: '#f59e0b', bodyBg: '#fff',
    border: '#f59e0b', cat: 'Lógica',
  },
  esperar_mensaje: {
    icon: AlarmClock, label: 'Esperar mensaje',
    desc: 'Espera un mensaje del usuario',
    color: '#f59e0b', headerBg: '#f59e0b', bodyBg: '#fff',
    border: '#f59e0b', cat: 'Lógica',
  },
  condicion: {
    icon: GitBranch, label: 'Condiciones',
    desc: 'Evalúa condiciones y ramifica',
    color: '#8b5cf6', headerBg: '#8b5cf6', bodyBg: '#fff',
    border: '#8b5cf6', cat: 'Lógica',
  },
  intencion: {
    icon: Brain, label: 'Detectar Intención',
    desc: 'Detecta intención por texto libre',
    color: '#8b5cf6', headerBg: '#8b5cf6', bodyBg: '#fff',
    border: '#8b5cf6', cat: 'Lógica',
  },

  // ── Integraciones ───────────────────────────────────────
  api_request: {
    icon: Globe, label: 'Api request',
    desc: 'Petición HTTP a API externa',
    color: '#3b82f6', headerBg: '#3b82f6', bodyBg: '#fff',
    border: '#3b82f6', cat: 'Integraciones',
  },

  // ── CRM ─────────────────────────────────────────────────
  etiquetar: {
    icon: Tag, label: 'Etiquetar',
    desc: 'Agrega etiqueta al contacto',
    color: '#64748b', headerBg: '#64748b', bodyBg: '#fff',
    border: '#64748b', cat: 'CRM',
  },
  desetiquetar: {
    icon: Tags, label: 'Desetiquetar',
    desc: 'Quita etiqueta al contacto',
    color: '#64748b', headerBg: '#64748b', bodyBg: '#fff',
    border: '#64748b', cat: 'CRM',
  },
  mover_etapa: {
    icon: MoveRight, label: 'Mover a etapa',
    desc: 'Avanza a otra etapa del flujo',
    color: '#64748b', headerBg: '#64748b', bodyBg: '#fff',
    border: '#64748b', cat: 'CRM',
  },
  asignar_equipo: {
    icon: Users, label: 'Asignar Equipo',
    desc: 'Asigna el contacto a un equipo',
    color: '#dc2626', headerBg: '#dc2626', bodyBg: '#fff',
    border: '#dc2626', cat: 'CRM',
  },
  notificacion_chat: {
    icon: Bell, label: 'Notificación de Chat',
    desc: 'Agrega una notificación al chat',
    color: '#64748b', headerBg: '#64748b', bodyBg: '#fff',
    border: '#64748b', cat: 'CRM',
  },
  eliminar_contacto: {
    icon: Trash2, label: 'Eliminar contacto',
    desc: 'Elimina el contacto del sistema',
    color: '#dc2626', headerBg: '#dc2626', bodyBg: '#fff',
    border: '#dc2626', cat: 'CRM',
  },
  cerrar_conversacion: {
    icon: XCircle, label: 'Cerrar conversación',
    desc: 'Cierra la conversación actual',
    color: '#475569', headerBg: '#475569', bodyBg: '#fff',
    border: '#475569', cat: 'CRM',
  },

  // ── Validaciones ────────────────────────────────────────
  validar_banxico: {
    icon: Shield, label: 'Validar Banxico',
    desc: 'Valida el comprobante con Banxico',
    color: '#0369a1', headerBg: '#0369a1', bodyBg: '#fff',
    border: '#0369a1', cat: 'Validaciones',
  },

  // ── Especiales ──────────────────────────────────────────
  accion: {
    icon: Zap, label: 'Acción',
    desc: 'Ejecuta una acción del sistema',
    color: '#dc2626', headerBg: '#dc2626', bodyBg: '#fff',
    border: '#dc2626', cat: 'CRM',
  },
  fin: {
    icon: Flag, label: 'Fin',
    desc: 'Cierra la conversación del bot',
    color: '#475569', headerBg: '#475569', bodyBg: '#fff',
    border: '#475569', cat: 'CRM',
  },
};

/* ── Componente genérico de nodo ─────────────────────────────────────────── */
function FlowNode({ data, selected, tipo }) {
  const cfg    = TIPO_CONFIG[tipo] || TIPO_CONFIG.mensaje;
  const Icon   = cfg.icon;
  const opciones = Array.isArray(data.opciones) ? data.opciones : [];
  const tieneOpciones = (tipo === 'lista_opciones' || tipo === 'condicion') && opciones.length > 0;

  return (
    <div
      className={`fn-card${selected ? ' fn-card--selected' : ''}`}
      style={{
        '--fn-color': cfg.color,
        boxShadow: selected
          ? `0 0 0 2px ${cfg.color}, 0 8px 24px rgba(0,0,0,0.14)`
          : '0 2px 10px rgba(0,0,0,0.10)',
      }}
    >
      {/* Conector de entrada — lado izquierdo */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="fn-handle fn-handle--in"
        style={{ top: '50%' }}
      />

      {/* Cabecera de color */}
      <div className="fn-header" style={{ background: cfg.color }}>
        <div className="fn-header-icon">
          <Icon size={14} strokeWidth={2.2} color="#fff" />
        </div>
        <span className="fn-header-label">{cfg.label}</span>
      </div>

      {/* Cuerpo */}
      <div className="fn-body">
        <div className="fn-title">{data.label || cfg.label}</div>

        {data.texto && (
          <div className="fn-preview">{data.texto}</div>
        )}

        {tieneOpciones ? (
          <div className="fn-options">
            {opciones.map((op, i) => (
              <div key={op.valor || i} className="fn-option-row">
                <span className="fn-option-dot" />
                <span className="fn-option-text">
                  {op.texto || op.valor || `Opción ${i + 1}`}
                </span>
                {/* Conector de salida por cada opción */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={op.valor || String(i)}
                  className="fn-handle fn-handle--out"
                  style={{ top: 'auto', position: 'static', transform: 'none' }}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Conector de salida único */
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="fn-handle fn-handle--out fn-handle--single"
          />
        )}

        {/* Campo adicional para acción / espera */}
        {tipo === 'accion' && data.accion && (
          <div className="fn-tag">⚡ {data.accion}</div>
        )}
        {tipo === 'esperar' && data.segundos && (
          <div className="fn-tag">⏱ {data.segundos}s</div>
        )}
        {tipo === 'asignar_equipo' && data.equipo && (
          <div className="fn-tag">👥 {data.equipo}</div>
        )}
        {tipo === 'api_request' && data.url && (
          <div className="fn-tag fn-tag--url">🔗 {data.url}</div>
        )}
      </div>
    </div>
  );
}

/* ── Exportación de tipos ────────────────────────────────────────────────── */
export const MensajeNode         = (p) => <FlowNode {...p} tipo="mensaje"            />;
export const ListaOpcionesNode   = (p) => <FlowNode {...p} tipo="lista_opciones"     />;
export const EsperarNode         = (p) => <FlowNode {...p} tipo="esperar"            />;
export const EsperarMensajeNode  = (p) => <FlowNode {...p} tipo="esperar_mensaje"    />;
export const CondicionNode       = (p) => <FlowNode {...p} tipo="condicion"          />;
export const IntencionNode       = (p) => <FlowNode {...p} tipo="intencion"          />;
export const ApiRequestNode      = (p) => <FlowNode {...p} tipo="api_request"        />;
export const EtiquetarNode       = (p) => <FlowNode {...p} tipo="etiquetar"          />;
export const DesetiquetarNode    = (p) => <FlowNode {...p} tipo="desetiquetar"       />;
export const MoverEtapaNode      = (p) => <FlowNode {...p} tipo="mover_etapa"        />;
export const AsignarEquipoNode   = (p) => <FlowNode {...p} tipo="asignar_equipo"     />;
export const NotificacionChatNode= (p) => <FlowNode {...p} tipo="notificacion_chat"  />;
export const EliminarContactoNode= (p) => <FlowNode {...p} tipo="eliminar_contacto"  />;
export const CerrarConvNode      = (p) => <FlowNode {...p} tipo="cerrar_conversacion"/>;
export const ValidarBanxicoNode  = (p) => <FlowNode {...p} tipo="validar_banxico"    />;
export const AccionNode          = (p) => <FlowNode {...p} tipo="accion"             />;
export const FinNode             = (p) => <FlowNode {...p} tipo="fin"                />;

export const nodeTypes = {
  mensaje:             MensajeNode,
  lista_opciones:      ListaOpcionesNode,
  esperar:             EsperarNode,
  esperar_mensaje:     EsperarMensajeNode,
  condicion:           CondicionNode,
  intencion:           IntencionNode,
  api_request:         ApiRequestNode,
  etiquetar:           EtiquetarNode,
  desetiquetar:        DesetiquetarNode,
  mover_etapa:         MoverEtapaNode,
  asignar_equipo:      AsignarEquipoNode,
  notificacion_chat:   NotificacionChatNode,
  eliminar_contacto:   EliminarContactoNode,
  cerrar_conversacion: CerrarConvNode,
  validar_banxico:     ValidarBanxicoNode,
  accion:              AccionNode,
  fin:                 FinNode,
};
