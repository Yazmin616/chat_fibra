import React from 'react';
import { ThumbsUp, Minus, ThumbsDown } from 'lucide-react';

const CONFIG = {
  Bien:    { bg: '#22c55e22', color: '#22c55e', Icon: ThumbsUp   },
  Regular: { bg: '#f9731622', color: '#f97316', Icon: Minus      },
  Mal:     { bg: '#ef444422', color: '#ef4444', Icon: ThumbsDown },
};

const RatingBadge = ({ puntuacion }) => {
  const cfg = CONFIG[puntuacion] || { bg: '#64748b22', color: '#64748b', Icon: Minus };
  const { Icon } = cfg;
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
      {puntuacion}
    </span>
  );
};

export default RatingBadge;
