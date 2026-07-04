import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Clock, User, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/api';

/**
 * Panel que muestra el historial de transferencias de una conversación.
 * Se incrusta dentro de la ficha del contacto (InfoPanel) en ChatWindow.
 *
 * Props:
 *   conversacion_id — PK de la conversación activa.
 */
const TransferLogPanel = ({ conversacion_id }) => {
  const [registros,  setRegistros]  = useState([]);
  const [cargando,   setCargando]   = useState(false);
  const [expandido,  setExpandido]  = useState(false);

  useEffect(() => {
    if (!expandido || !conversacion_id) return;
    setCargando(true);
    apiService.getTransferencias(conversacion_id)
      .then(data => setRegistros(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [expandido, conversacion_id]);

  const formatFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (!expandido) {
    return (
      <button className="transfer-log-toggle" onClick={() => setExpandido(true)}>
        <ArrowRightLeft size={13} />
        Ver historial de transferencias
      </button>
    );
  }

  return (
    <div className="transfer-log-panel">
      <div className="transfer-log-header">
        <ArrowRightLeft size={14} />
        <span>Historial de transferencias</span>
        <button className="transfer-log-collapse" onClick={() => setExpandido(false)}>Ocultar</button>
      </div>

      {cargando && <p className="transfer-log-empty">Cargando…</p>}

      {!cargando && registros.length === 0 && (
        <p className="transfer-log-empty">Sin transferencias registradas.</p>
      )}

      {!cargando && registros.map(r => (
        <div key={r.id} className={`transfer-log-item tipo-${r.tipo}`}>
          <div className="transfer-log-tipo-badge">
            {r.tipo === 'mismo_equipo' ? '🔄 Mismo equipo' : '🔀 Otro equipo'}
          </div>
          <div className="transfer-log-line">
            <User size={11} />
            <span><strong>{r.agente_origen_nombre}</strong> ({r.area_origen})</span>
            <span className="transfer-log-arrow">→</span>
            <span><strong>{r.area_destino}</strong></span>
          </div>
          <div className="transfer-log-nota">"{r.nota}"</div>
          <div className="transfer-log-meta">
            <Clock size={10} />
            {formatFecha(r.created_at)}
            {r.tomado_por_nombre && (
              <>
                <CheckCircle size={10} style={{ marginLeft: '6px', color: '#22c55e' }} />
                Tomado por <strong>{r.tomado_por_nombre}</strong> · {formatFecha(r.tomado_at)}
              </>
            )}
            {!r.tomado_por_nombre && (
              <span style={{ color: '#f59e0b', marginLeft: '6px' }}>⏳ En espera</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransferLogPanel;
