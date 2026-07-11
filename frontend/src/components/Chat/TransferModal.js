import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, RefreshCw, User } from 'lucide-react';
import { apiService } from '../../services/api';

const AREAS = ['Ventas', 'Cobranza', 'Soporte Técnico'];

/**
 * Modal para transferir un chat a la cola de un equipo.
 *
 * Caso 1 — mismo equipo: el agente selecciona su misma área (cambio de turno).
 *   El chat se desasigna y vuelve a la cola del mismo equipo.
 * Caso 2 — otro equipo: el agente selecciona un área distinta.
 *   El chat cambia de departamento y entra a la cola del área destino.
 *
 * Props:
 *   clienteNombre  — nombre del cliente (para el título).
 *   areaActual     — área del agente que transfiere (pre-seleccionada).
 *   onConfirmar(areaDestino, nota) — callback al confirmar.
 *   onCancelar()  — callback al cancelar.
 */
const TransferModal = ({ clienteNombre, areaActual, onConfirmar, onCancelar }) => {
  const [areaDestino, setAreaDestino] = useState(areaActual || AREAS[0]);
  const [agenteDestinoId, setAgenteDestinoId] = useState('');
  const [agentes,     setAgentes]     = useState([]);
  const [nota,        setNota]        = useState('');
  const [cargando,    setCargando]    = useState(false);
  const overlayRef   = useRef(null);
  const textareaRef  = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
    apiService.getDirectorioAgentes().then(setAgentes).catch(console.error);
  }, []);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onCancelar]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onCancelar();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nota.trim() || cargando) return;
    setCargando(true);
    let idAgente = agenteDestinoId;
    let nombreAgente = null;
    if (idAgente) {
      const selected = agentes.find(a => a.id === Number(idAgente));
      if (selected) nombreAgente = selected.nombre;
    }
    await onConfirmar(areaDestino, nota.trim(), idAgente, nombreAgente);
    setCargando(false);
  };

  const esMismoEquipo = areaDestino === areaActual;
  const esDirecta = !!agenteDestinoId;
  const agentesArea = agentes.filter(a => a.area === areaDestino);

  return (
    <div className="cc-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="cc-modal">
        <div className="cc-header">
          <div className="cc-header-icon">
            <ArrowRightLeft size={20} color="#3b82f6" />
          </div>
          <div>
            <h2 className="cc-title">Transferir chat</h2>
            {clienteNombre && (
              <p className="cc-subtitle">con {clienteNombre}</p>
            )}
          </div>
          <button className="cc-close" onClick={onCancelar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form className="cc-body" onSubmit={handleSubmit}>

          {/* Área origen (informativa) */}
          <div className="cc-field">
            <label className="cc-label">Área actual</label>
            <div className="transfer-area-origin">{areaActual || '—'}</div>
          </div>

          {/* Área destino */}
          <div className="cc-field">
            <label className="cc-label">Transferir a</label>
            <select
              className="cc-input"
              value={areaDestino}
              onChange={e => setAreaDestino(e.target.value)}
            >
              {AREAS.map(a => (
                <option key={a} value={a}>{a}{a === areaActual ? ' (mismo equipo)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Agente destino */}
          <div className="cc-field">
            <label className="cc-label">Agente (opcional)</label>
            <select
              className="cc-input"
              value={agenteDestinoId}
              onChange={e => setAgenteDestinoId(e.target.value)}
            >
              <option value="">Cola general del grupo</option>
              {agentesArea.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre} {a.esta_online ? '(En línea)' : '(Desconectado)'}
                </option>
              ))}
            </select>
          </div>

          {/* Indicador de tipo */}
          <div className={`transfer-tipo-badge ${esDirecta ? 'directa' : (esMismoEquipo ? 'mismo' : 'otro')}`}>
            {esDirecta ? (
              <><User size={14} style={{marginRight: '6px'}} /> Transferencia directa al asesor</>
            ) : esMismoEquipo ? (
              <><RefreshCw size={14} style={{marginRight: '6px'}} /> Cambio de turno — el chat vuelve a la cola de este equipo</>
            ) : (
              <><ArrowRightLeft size={14} style={{marginRight: '6px'}} /> Cambio de área — el chat pasa a la cola de {areaDestino}</>
            )}
          </div>

          {/* Nota obligatoria */}
          <div className="cc-field">
            <label className="cc-label">
              Nota de contexto
              <span style={{ color: '#e74c3c', marginLeft: '4px' }}>*</span>
            </label>
            <textarea
              ref={textareaRef}
              className="cc-textarea"
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Describe brevemente el motivo de la transferencia y el contexto del caso (ej. cliente quiere consultar su pago de mayo)…"
              maxLength={500}
              rows={4}
              required
            />
            <span className="cc-char-count">{nota.length}/500</span>
          </div>

          <div className="cc-actions">
            <button type="button" className="cc-btn-cancel" onClick={onCancelar} disabled={cargando}>
              Cancelar
            </button>
            <button
              type="submit"
              className="cc-btn-confirm"
              style={{ background: '#3b82f6' }}
              disabled={cargando || !nota.trim()}
            >
              {cargando ? 'Transfiriendo…' : 'Transferir chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferModal;
