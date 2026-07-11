import React from 'react';
import { Smile, Meh, Frown, Minus } from 'lucide-react';

const CONFIG = {
  '5': { bg: '#dcfce7', color: '#16a34a', Icon: Smile, label: 'Excelente' },
  '4': { bg: '#fef9c3', color: '#ca8a04', Icon: Meh, label: 'Bien' },
  '3': { bg: '#ffedd5', color: '#f97316', Icon: Frown, label: 'Regular' },
  '2': { bg: '#fee2e2', color: '#ef4444', Icon: Frown, label: 'Malo' },
  '1': { bg: '#fef2f2', color: '#dc2626', Icon: Frown, label: 'Muy Malo' },
  // Backward compatibility
  Bien:    { bg: '#dcfce7', color: '#16a34a', Icon: Smile, label: 'Bien'   },
  Regular: { bg: '#ffedd5', color: '#f97316', Icon: Meh, label: 'Regular'      },
  Mal:     { bg: '#fee2e2', color: '#ef4444', Icon: Frown, label: 'Mal' },
};

const RatingBadge = ({ puntuacion }) => {
  const cfg = CONFIG[puntuacion] || { bg: '#64748b22', color: '#64748b', Icon: Minus, label: puntuacion };
  const { Icon, label } = cfg;
  return (
    <span style={{
      background:   cfg.bg,
      color:        cfg.color,
      padding:      '3px 8px',
      borderRadius: '12px',
      fontSize:     '11px',
      fontWeight:   700,
      whiteSpace:   'nowrap',
      display:      'inline-flex',
      alignItems:   'center',
      gap:          4,
    }}>
      <Icon size={11} />
      {label}
    </span>
  );
};

export default RatingBadge;
