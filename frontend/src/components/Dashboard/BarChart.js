/**
 * @file BarChart.js
 * @description Gráfica de barras verticales para visualizar la actividad diaria de chats.
 * Cada barra representa el número de chats de un día específico.
 * La altura es relativa al máximo del conjunto de datos.
 *
 * Uso:
 *   <BarChart data={[{ dia: 'Lun', chats: 12 }, { dia: 'Mar', chats: 8 }]} />
 */

import React from 'react';

/**
 * @param {object}   props
 * @param {Array<{ dia: string, chats: number|string }>} props.data - Datos de actividad diaria.
 */
const BarChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
        Sin actividad en los últimos 7 días
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => parseInt(d.chats)), 1);

  return (
    <div className="bar-chart-container">
      {data.map((d, i) => {
        const h = Math.max(8, (parseInt(d.chats) / maxVal) * 100);
        return (
          <div key={i} className="bar-col">
            <div className="bar-value">{d.chats}</div>
            <div className="bar-fill" style={{ height: `${h}%` }} />
            <div className="bar-label">{d.dia}</div>
          </div>
        );
      })}
    </div>
  );
};

export default BarChart;
