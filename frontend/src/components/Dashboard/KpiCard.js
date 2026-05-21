/**
 * @file KpiCard.js
 * @description Tarjeta de indicador clave de rendimiento (KPI).
 * Muestra un ícono de color, una etiqueta descriptiva y el valor numérico o porcentual.
 *
 * Uso:
 *   <KpiCard icon={MessageSquare} label="Chats Hoy" value={42} color="#3b82f6" />
 */

import React from 'react';

/**
 * @param {object} props
 * @param {React.ElementType} props.icon  - Componente de ícono (lucide-react).
 * @param {string}            props.label - Texto descriptivo debajo del valor.
 * @param {string|number}     props.value - Valor a mostrar.
 * @param {string}            props.color - Color HEX para el ícono y fondo del contenedor.
 */
const KpiCard = ({ icon: Icon, label, subtitle, value, color }) => (
  <div className="kpi-card" style={{ '--kpi-color': color }}>
    <div className="kpi-icon" style={{ background: `${color}15` }}>
      <Icon size={24} color={color} />
    </div>
    <div className="kpi-body">
      <div className="kpi-value">{value ?? '0'}</div>
      <div className="kpi-label">{label}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
    </div>
  </div>
);

export default KpiCard;
