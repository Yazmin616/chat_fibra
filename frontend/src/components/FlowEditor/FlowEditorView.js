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
  Loader2, CheckCircle2, AlertCircle, ChevronDown,
} from 'lucide-react';

import { nodeTypes, TIPO_CONFIG } from './customNodes';
import EditPanel from './EditPanel';
import { apiService } from '../../services/api';
import '../../styles/flow-editor.css';

/* ── Constantes ─────────────────────────────────────────────────────────── */
const EDGE_DEFAULTS = {
  type:                'smoothstep',          // líneas ortogonales — mucho más limpias
  markerEnd:           { type: MarkerType.ArrowClosed, color: '#cbd5e1', width: 14, height: 14 },
  style:               { stroke: '#cbd5e1', strokeWidth: 1.5 },
  animated:            false,
  labelStyle:          { fill: '#64748b', fontSize: 10, fontWeight: 600 },
  labelBgStyle:        { fill: '#ffffff', fillOpacity: 0.95 },
  labelBgPadding:      [5, 2],
  labelBgBorderRadius: 4,
};

// Grupos de paleta: cada grupo tiene una categoría y una lista de tipos
const PALETTE_GROUPS = [
  {
    cat: 'Mensajería',
    tipos: ['mensaje', 'lista_opciones'],
  },
  {
    cat: 'Lógica',
    tipos: ['esperar', 'esperar_mensaje', 'condicion', 'intencion'],
  },
  {
    cat: 'Integraciones',
    tipos: ['api_request'],
  },
  {
    cat: 'CRM',
    tipos: [
      'asignar_equipo', 'notificacion_chat', 'cerrar_conversacion', 'fin',
    ],
  },
];

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
    targetHandle: c.targetHandle || null,
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
    targetHandle: e.targetHandle || null,
    label:        e.label || '',
  }));
}

let nodeCounter = 1000;
function newNodeId() { return `node_${++nodeCounter}`; }

/* ── Componente: grupo de paleta colapsable ──────────────────────────────── */
function PaletteGroup({ cat, tipos, onDragStart }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="fp-group">
      <button className="fp-group-title" onClick={() => setOpen(o => !o)}>
        {cat}
        <ChevronDown size={12} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
      </button>
      {open && tipos.map(tipo => {
        const cfg  = TIPO_CONFIG[tipo];
        if (!cfg) return null;
        const Icon = cfg.icon;
        return (
          <div
            key={tipo}
            className="fp-item"
            draggable
            onDragStart={e => onDragStart(e, tipo)}
            title={cfg.desc}
          >
            <div className="fp-item-icon" style={{ background: cfg.color }}>
              <Icon size={13} strokeWidth={2.2} color="#fff" />
            </div>
            <div className="fp-item-text">
              <span className="fp-item-label">{cfg.label}</span>
              <span className="fp-item-desc">{cfg.desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Componente principal ──────────────────────────────────────────────── */
export default function FlowEditorView({ empresaId, user }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [nodes,    setNodes,   onNodesChange] = useNodesState([]);
  const [edges,    setEdges,   onEdgesChange] = useEdgesState([]);
  const [selected, setSelected]               = useState(null);
  const [empresa,  setEmpresa]                = useState(empresaId || 'fibratec');
  const [loading,  setLoading]                = useState(false);
  const [saving,   setSaving]                 = useState(false);
  const [dirty,    setDirty]                  = useState(false);
  const [status,   setStatus]                 = useState(null);

  const [activo, setActivo] = useState(false);
  const [flujoId, setFlujoId] = useState(null);
  const rfWrapper     = useRef(null);
  const rfInstanceRef = useRef(null);

  const onInit = useCallback(instance => { rfInstanceRef.current = instance; }, []);

  /* ── Carga ──────────────────────────────────────────────────────── */
  const cargar = useCallback(async (eid) => {
    setLoading(true);
    try {
      const data = await apiService.getFlujo(eid || empresa);
      setNodes(dbNodosToRF(data.nodos));
      setEdges(dbConexionesToRF(data.conexiones));
      setActivo(!!data.activo);
      setFlujoId(data.id || null);
      setDirty(false);
      setSelected(null);
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.18, duration: 400 }), 150);
    } catch (e) {
      showStatus('err', 'Error al cargar flujo: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, setNodes, setEdges]);

  useEffect(() => { cargar(empresaId || empresa); }, []); // eslint-disable-line

  const handleToggleActivo = async () => {
    if (!flujoId) return;
    const nuevoEstado = !activo;
    setLoading(true);
    try {
      await apiService.toggleFlujoActivo(flujoId, nuevoEstado);
      setActivo(nuevoEstado);
      showStatus('ok', nuevoEstado ? 'Flujo visual HABILITADO.' : 'Flujo visual DESHABILITADO. Se usa bot tradicional.');
    } catch (e) {
      showStatus('err', 'Error al cambiar estado: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmpresaChange = e => {
    setEmpresa(e.target.value);
    cargar(e.target.value);
  };

  /* ── Guardar ────────────────────────────────────────────────────── */
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

  /* ── Canvas events ──────────────────────────────────────────────── */
  const onConnect = useCallback(params => {
    setEdges(prev => addEdge({ ...params, ...EDGE_DEFAULTS }, prev));
    setDirty(true);
  }, [setEdges]);

  const onNodeClick    = useCallback((_e, node) => setSelected(node), []);
  const onPaneClick    = useCallback(() => setSelected(null), []);

  const onEditChange = newData => {
    setNodes(prev => prev.map(n => n.id === selected.id ? { ...n, data: newData } : n));
    setSelected(prev => ({ ...prev, data: newData }));
    setDirty(true);
  };

  const onDeleteNode = id => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    setSelected(null);
    setDirty(true);
  };

  const onNodesChangeWrapped = useCallback(changes => {
    onNodesChange(changes);
    if (changes.some(c => c.type === 'position' || c.type === 'remove')) setDirty(true);
  }, [onNodesChange]);

  /* ── Drag & Drop desde paleta ───────────────────────────────────── */
  const onDragStart = (e, tipo) => {
    e.dataTransfer.setData('application/reactflow-tipo', tipo);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback(e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData('application/reactflow-tipo');
    if (!tipo || !rfWrapper.current) return;

    const bounds   = rfWrapper.current.getBoundingClientRect();
    const rfInst   = rfInstanceRef.current;
    let position   = { x: e.clientX - bounds.left - 110, y: e.clientY - bounds.top - 40 };

    // Si tenemos acceso al viewport de ReactFlow, proyectamos correctamente
    if (rfInst && rfInst.project) {
      position = rfInst.project({
        x: e.clientX - bounds.left - 110,
        y: e.clientY - bounds.top  - 40,
      });
    }

    const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.mensaje;
    const id  = newNodeId();

    setNodes(prev => [...prev, {
      id,
      type: tipo,
      position,
      data: {
        label:   cfg.label,
        texto:   '',
        opciones: (tipo === 'lista_opciones' || tipo === 'condicion' || tipo === 'intencion') ? [] : undefined,
      },
    }]);
    setDirty(true);
  }, [setNodes]);

  const isAdmin = user?.rol === 'admin';
  const busy    = loading || saving;

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '32px',
        textAlign: 'center',
        background: '#ffffff',
        boxSizing: 'border-box'
      }}>
        <img 
          src="/fibri.png" 
          alt="Fibri" 
          style={{ 
            width: '150px', 
            height: 'auto', 
            marginBottom: '24px',
            animation: 'float 3s ease-in-out infinite' 
          }} 
        />
        <style>{`
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }
        `}</style>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
          Flujo del Bot
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>
          Para editar y organizar el flujo del bot, te recomendamos iniciar sesión desde una computadora.
        </p>
      </div>
    );
  }

  return (
    <div className="flow-editor-root">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flow-toolbar">
        <div className="flow-toolbar-title">
          <GitBranch size={17} color="#0d9488" strokeWidth={2} />
          <h2>Editor de Flujo del Bot</h2>
        </div>

        {isAdmin && (
          <div className="flow-empresa-wrap">
            {empresa === '__todas__' ? <Globe size={13} /> : <Building2 size={13} />}
            <select value={empresa} onChange={handleEmpresaChange} disabled={busy}>
              <option value="fibratec">fibratec</option>
              <option value="compusemmm">compusemmm</option>
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {dirty && !saving && (
          <div className="flow-dirty-badge">
            <span className="flow-dirty-dot" /> Sin guardar
          </div>
        )}

        <button className="flow-btn flow-btn-secondary" onClick={() => cargar(empresa)} disabled={busy}>
          <RotateCcw size={14} className={loading ? 'flow-spin' : ''} />
          Recargar
        </button>

        <button className="flow-btn flow-btn-primary" onClick={guardar} disabled={busy || !dirty}>
          {saving ? <Loader2 size={14} className="flow-spin" /> : <Save size={14} />}
          {saving ? 'Guardando…' : 'Guardar flujo'}
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flow-body">

        {/* Paleta */}
        <div className="flow-palette">
          <div className="fp-header">Tipos de nodo</div>
          {PALETTE_GROUPS.map(g => (
            <PaletteGroup key={g.cat} cat={g.cat} tipos={g.tipos} onDragStart={onDragStart} />
          ))}
        </div>

        {/* Canvas */}
        <div className="flow-canvas" ref={rfWrapper} onDragOver={onDragOver} onDrop={onDrop}>
          {loading && (
            <div className="flow-canvas-loading">
              <Loader2 size={18} className="flow-spin" color="#0d9488" />
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
            minZoom={0.25}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={20} size={1.2} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={n => TIPO_CONFIG[n.type]?.color || '#94a3b8'}
              maskColor="rgba(248,250,252,0.75)"
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

      {/* Toast */}
      {status && (
        <div className={`flow-status flow-status-${status.tipo}`}>
          {status.tipo === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {status.msg}
        </div>
      )}
    </div>
  );
}
