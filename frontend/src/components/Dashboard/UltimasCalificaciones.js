import React from 'react';
import { User, Bot } from 'lucide-react';
import RatingBadge from './RatingBadge';

const RATING_COLOR = {
  '5': '#22c55e',
  '4': '#eab308',
  '3': '#f97316',
  '2': '#ef4444',
  '1': '#dc2626',
};

const UltimasCalificaciones = ({ calificaciones }) => (
  <div className="ratings-list">
    {calificaciones?.map((cal, i) => {
      const esBot = cal.tipo === 'bot';
      return (
        <div
          key={i}
          className={`rating-row${esBot ? ' rating-row--no-atencion' : ''}`}
          style={{ '--rating-color': RATING_COLOR[cal.puntuacion] || '#a0aec0' }}
        >
          <div className="rating-badge-wrap">
            <RatingBadge puntuacion={cal.puntuacion} />
          </div>

          <div className="rating-info">
            <span className="rating-client">{cal.cliente}</span>

            <div className="rating-details">
              {esBot ? (
                <span className="rating-no-atencion">
                  <Bot size={11} />
                  Autoservicio · resuelto por el bot
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} /> {cal.agente || '—'}
                </span>
              )}
              {cal.departamento && (
                <> · <span className="rating-area">{cal.departamento}</span></>
              )}
            </div>

            <span className="rating-time">
              {new Date(cal.created_at).toLocaleString('es-MX', {
                day:    '2-digit',
                month:  'short',
                hour:   '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

export default UltimasCalificaciones;
