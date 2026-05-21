import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../../services/api';
import UltimasCalificaciones from './UltimasCalificaciones';

const CalificacionesModal = ({ user, empresaId, filtroAgente, filtroArea, onClose }) => {
  const [calificaciones, setCalificaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService
      .getCalificaciones(user?.id, empresaId, filtroAgente, filtroArea)
      .then(rows => setCalificaciones(rows))
      .catch(err => console.error('[CalificacionesModal]', err))
      .finally(() => setLoading(false));
  }, [user?.id, empresaId, filtroAgente, filtroArea]);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Todas las evaluaciones</h2>
            {!loading && (
              <p className="modal-subtitle">{calificaciones.length} evaluación{calificaciones.length !== 1 ? 'es' : ''} en total</p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="dashboard-loading" style={{ minHeight: 120 }}>
              <div className="spinner" />
              <p>Cargando evaluaciones...</p>
            </div>
          ) : calificaciones.length === 0 ? (
            <p className="modal-empty">No hay evaluaciones registradas aún.</p>
          ) : (
            <UltimasCalificaciones calificaciones={calificaciones} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CalificacionesModal;
