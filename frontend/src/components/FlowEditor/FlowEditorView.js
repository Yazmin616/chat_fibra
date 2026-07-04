import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Save, RotateCcw, GitBranch, Building2, Globe,
  Loader2, CheckCircle2, AlertCircle,
  MessageSquare, HelpCircle, Zap, Brain, Flag,
} from 'lucide-react';

import { nodeTypes, TIPO_CONFIG } from './customNodes';
import EditPanel from './EditPanel';
import { apiService } from '../../services/api';
import '../../styles/flow-editor.css';

/* ── Constantes ─────────────────────────────────────────────────────────── */
const TIPO_ORDEN = ['mensaje', 'pregunta', 'condicion', 'accion', 'intencion', 'fin'];
const TIPO_ICONS_UI = {
  mensaje: MessageSquare, pregunta: HelpCircle, condicion: GitBranch,
  accion:  Zap,          intencion: Brain,      fin:       Flag,
};

const EDGE_DEFAULTS = {
  markerEnd:           { type: MarkerType.ArrowClosed, color: '#64748b' },
  style:               { stroke: '#64748b', strokeWidth: 2 },
  labelStyle:          { fill: '#374151', fontSize: 11, fontWeight: 600 },
  labelBgStyle:        { fill: '#ffffff', fillOpacity: 1 },
  labelBgPadding:      [6, 3],
  labelBgBorderRadius: 5,
};

/* ── Conversión BD ↔ React Flow ─────────────────────────────────────────── */
function dbNodosToRF(nodos) {
  return (nodos || []).map(n => ({
    id:       n.id,
    type:     n.tipo,
    position: n.posicion || { x: 0, y: 0 },
    data:     { ...n.datos },
  }));
}

function dbConexionesToRF(conexiones) {
  return (conexiones || []).map(c => ({
    id:           c.id,
    source:       c.source,
    target:       c.target,
    sourceHandle: c.sourceHandle || null,
    label:        c.label || '',
    ...EDGE_DEFAULTS,
  }));
}

function rfNodosToDb(rfNodes) {
  return rfNodes.map(n => ({
    id:       n.id,
    tipo:     n.type,
    posicion: n.position,
    datos:    n.data,
  }));
}

function rfEdgesToDb(rfEdges) {
  return rfEdges.map(e => ({
    id:           e.id,
    source:       e.source,
    target:       e.target,
    sourceHandle: e.sourceHandle || null,
    label:        e.label || '',
  }));
}

let nodeCounter = 1000;
function newNodeId() { return `node_${++nodeCounter}`; }

/* ── Componente principal ─────────────────────────────────────────────── */
export default function FlowEditorView({ empresaId, user }) {
  const [nodes,    setNodes,   onNodesChange] = useNodesState([]);
  const [edges,    setEdges,   onEdgesChange] = useEdgesState([]);
  const [selected, setSelected]               = useState(null);
  const [empresa,  setEmpresa]                = useState(empresaId || 'fibratec');
  const [loading,  setLoading]                = useState(false);
  const [saving,   setSaving]                 = useState(false);
  const [dirty,    setDirty]                  = useState(false);
  const [status,   setStatus]                 = useState(null);

  const rfWrapper     = useRef(null);
  const rfInstanceRef = useRef(null);

  const onInit = useCallback((instance) => {
    rfInstanceRef.current = instance;
  }, []);

  /* ── Carga el flujo ───────────────────────────────────────────────── */
  const cargar = useCallback(async (eid) => {
    setLoading(true);
    try {
      const data = await apiService.getFlujo(eid || empresa);
      setNodes(dbNodosToRF(data.nodos));
      setEdges(dbConexionesToRF(data.conexiones));
      setDirty(false);
      setSelected(null);
      // Fit view después de que React renderiza los nodos
      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.18, duration: 400 });
      }, 120);
    } catch (e) {
      showStatus('err', 'Error al cargar flujo: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, setNodes, setEdges]);

  useEffect(() => { cargar(empresaId || empresa); }, []); // eslint-disable-line

  const handleEmpresaChange = (e) => {
    setEmpresa(e.target.value);
    cargar(e.target.value);
  };

  /* ── Guardar ──────────────────────────────────────────────────────── */
  const guardar = async () => {
    setSaving(true);
    try {
      await apiService.saveFlujo(empresa, {
        nombre:     'Flujo principal',
        nodos:      rfNodosToDb(nodes),
        conexiones: rfEdgesToDb(edges),
        root_node:  'entrada',
      });
      setDirty(false);
      showStatus('ok', 'Flujo guardado — los cambios están activos.');
    } catch (e) {
      showStatus('err', 'Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  function showStatus(tipo, msg) {
    setStatus({ tipo, msg });
    setTimeout(() => setStatus(null), 3800);
  }

  /* ── Interacciones del canvas ────────────────────────────────────── */
  const onConnect = useCallback((params) => {
    setEdges(prev => addEdge({ ...params, ...EDGE_DEFAULTS }, prev));
    setDirty(true);
  }, [setEdges]);

  const onNodeClick = useCallback((_e, node) => setSelected(node), []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  const onEditChange = (newData) => {
    setNodes(prev => prev.map(n =>
      n.id === selected.id ? { ...n, data: newData } : n
    ));
    setSelected(prev => ({ ...prev, data: newData }));
    setDirty(true);
  };

  const onDeleteNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    setSelected(null);
    setDirty(true);
  };

  const onNodesChangeWrapped = useCallback((changes) => {
    onNodesChange(changes);
    // Solo marcar dirty en movimientos, no en selección/deselección
    const hasMoves = changes.some(c => c.type === 'position' || c.type === 'remove');
    if (hasMoves) setDirty(true);
  }, [onNodesChange]);

  /* ── Drag & Drop desde paleta ────────────────────────────────────── */
  const onDragStart = (e, tipo) => {
    e.dataTransfer.setData('application/reactflow-tipo', tipo);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData('application/reactflow-tipo');
    if (!tipo || !rfWrapper.current) return;

    const bounds   = rfWrapper.current.getBoundingClientRect();
    const position = {
      x: e.clientX - bounds.left - 105,
      y: e.clientY - bounds.top  - 50,
    };
    const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.mensaje;
    const id  = newNodeId();

    setNodes(prev => [...prev, {
      id,
      type: tipo,
      position,
      data: {
        label:       cfg.label,
        texto:       '',
        opciones:    tipo === 'pregunta'                        ? [] : undefined,
        accion:      tipo === 'accion'                         ? 'escalar_agente' : undefined,
        descripcion: (tipo === 'intencion' || tipo === 'fin')  ? '' : undefined,
      },
    }]);
    setDirty(true);
  }, [setNodes]);

  const isAdmin = user?.rol === 'admin';
  const busy    = loading || saving;

  return (
    <div className="flow-editor-root">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flow-toolbar">
        <div className="flow-toolbar-title">
          <GitBranch size={17} color="#6366f1" strokeWidth={2} />
          <h2>Editor de Flujo del Bot</h2>
        </div>

        {/* Selector de empresa */}
        <div className="flow-empresa-wrap">
          {empresa === '__todas__' ? <Globe size={13} /> : <Building2 size={13} />}
          {isAdmin ? (
            <select value={empresa} onChange={handleEmpresaChange} disabled={busy}>
              <option value="fibratec">fibratec</option>
              <option value="compusemmm">compusemmm</option>
            </select>
          ) : (
            <span>{empresa}</span>
          )}
        </div>

        <div className="flow-toolbar-sep" />

        <button
          className="flow-btn flow-btn-secondary"
          onClick={() => cargar(empresa)}
          disabled={busy}
          title="Recargar flujo desde la base de datos"
        >
          <RotateCcw size={14} className={loading ? 'flow-spin' : ''} />
          Recargar
        </button>

        <button
          className="flow-btn flow-btn-primary"
          onClick={guardar}
          disabled={busy || !dirty}
          title={!dirty ? 'Sin cambios por guardar' : 'Guardar y activar flujo'}
        >
          {saving
            ? <Loader2 size={14} className="flow-spin" />
            : <Save size={14} />
          }
          {saving ? 'Guardando…' : 'Guardar flujo'}
        </button>

        {dirty && !saving && (
          <div className="flow-dirty-badge">
            <span className="flow-dirty-dot" />
            Sin guardar
          </div>
        )}
      </div>

      {/* ── Body: paleta + canvas + panel ────────────────────────────── */}
      <div className="flow-body">

        {/* Paleta de nodos */}
        <div className="flow-palette">
          <div className="flow-palette-section">Tipos de nodo</div>

          {TIPO_ORDEN.map(tipo => {
            const cfg  = TIPO_CONFIG[tipo];
            const Icon = TIPO_ICONS_UI[tipo] || MessageSquare;
            return (
              <div
                key={tipo}
                className="flow-palette-item"
                data-tipo={tipo}
                draggable
                onDragStart={e => onDragStart(e, tipo)}
                title={cfg.desc}
              >
                <div
                  className="flow-node-icon"
                  style={{ background: cfg.color, width: 30, height: 30, borderRadius: 7 }}
                >
                  <Icon size={14} strokeWidth={2} />
                </div>
                <div className="flow-palette-text">
                  <span className="flow-palette-label">{cfg.label}</span>
                  <span className="flow-palette-desc">{cfg.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <div
          className="flow-canvas"
          ref={rfWrapper}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {loading && (
            <div className="flow-canvas-loading">
              <Loader2 size={18} className="flow-spin" color="#6366f1" />
              Cargando flujo…
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChangeWrapped}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={onInit}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            deleteKeyCode="Delete"
            defaultEdgeOptions={EDGE_DEFAULTS}
            minZoom={0.3}
            maxZoom={1.8}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#cbd5e1"
              gap={22}
              size={1.2}
            />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={n => {
                const colors = {
                  mensaje: '#6366f1', pregunta: '#22c55e', condicion: '#f59e0b',
                  accion:  '#ef4444', intencion: '#8b5cf6', fin:       '#64748b',
                };
                return colors[n.type] || '#94a3b8';
              }}
              maskColor="rgba(248,250,252,0.7)"
              style={{ width: 160, height: 100 }}
            />
          </ReactFlow>
        </div>

        {/* Panel derecho */}
        <EditPanel
          node={selected}
          nodes={nodes}
          edges={edges}
          onClose={() => setSelected(null)}
          onChange={onEditChange}
          onDelete={onDeleteNode}
        />
      </div>

      {/* Toast de estado */}
      {status && (
        <div className={`flow-status flow-status-${status.tipo}`}>
          {status.tipo === 'ok'
            ? <CheckCircle2 size={15} />
            : <AlertCircle size={15} />
          }
          {status.msg}
        </div>
      )}
    </div>
  );
}
