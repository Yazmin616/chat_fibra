/**
 * @file DonutChart.js
 * @description Gráfica de dona SVG que visualiza la distribución de calificaciones CSAT.
 * Muestra tres segmentos: Bien (verde), Regular (naranja), Mal (rojo).
 * En el centro muestra el total de evaluaciones.
 *
 * Uso:
 *   <DonutChart bien={30} regular={10} mal={5} total={45} />
 */

import React from 'react';
import { Bot } from 'lucide-react';

/**
 * @param {object} props
 * @param {number|string} props.bien    - Cantidad de calificaciones "Bien".
 * @param {number|string} props.regular - Cantidad de calificaciones "Regular".
 * @param {number|string} props.mal     - Cantidad de calificaciones "Mal".
 * @param {number|string} [props.total] - Total (se recalcula internamente si se omite).
 */
const DonutChart = ({ bien, regular, mal, sin_atencion }) => {
  const b   = parseInt(bien)    || 0;
  const r   = parseInt(regular) || 0;
  const m   = parseInt(mal)     || 0;
  const tot = b + r + m || 1;

  const pct = {
    bien:    (b / tot) * 100,
    regular: (r / tot) * 100,
    mal:     (m / tot) * 100,
  };

  const radius = 54;
  const circ   = 2 * Math.PI * radius;

  const segments = [
    { pct: pct.bien,    color: '#22c55e', label: 'Bien',    val: b },
    { pct: pct.regular, color: '#f97316', label: 'Regular', val: r },
    { pct: pct.mal,     color: '#ef4444', label: 'Mal',     val: m },
  ];

  let cumulative = 0;

  return (
    <div className="donut-container">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {segments.map((seg, i) => {
          const dash   = (seg.pct / 100) * circ;
          const gap    = circ - dash;
          const rotate = -90 + (cumulative / 100) * 360;
          cumulative  += seg.pct;
          return (
            <circle
              key={i}
              cx="70" cy="70" r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset="0"
              style={{
                transform: `rotate(${rotate}deg)`,
                transformOrigin: '70px 70px',
                transition: 'stroke-dasharray 0.6s ease',
              }}
            />
          );
        })}
        <text x="70" y="65" textAnchor="middle" style={{ fill: 'var(--dash-text-primary)' }} fontSize="22" fontWeight="bold">
          {b + r + m}
        </text>
        <text x="70" y="83" textAnchor="middle" style={{ fill: 'var(--dash-text-muted)' }} fontSize="10">
          evaluaciones
        </text>
      </svg>

      <div className="donut-legend">
        {segments.map(item => (
          <div key={item.label} className="legend-row">
            <span className="legend-dot"  style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
            <span className="legend-val">{item.val}</span>
            <span className="legend-pct"  style={{ color: item.color }}>
              {b + r + m > 0 ? Math.round((item.val / (b + r + m)) * 100) : 0}%
            </span>
          </div>
        ))}

        {parseInt(sin_atencion) > 0 && (
          <div className="legend-row legend-row--no-atencion">
            <Bot size={11} color="#8b5cf6" style={{ flexShrink: 0 }} />
            <span className="legend-label" style={{ color: '#8b5cf6' }}>Autoservicio</span>
            <span className="legend-val"   style={{ color: '#8b5cf6' }}>{sin_atencion}</span>
            <span className="legend-pct"   style={{ color: '#a0aec0', fontSize: 9 }}>
              resuelto por el bot
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonutChart;
