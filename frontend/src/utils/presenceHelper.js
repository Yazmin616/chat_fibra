/**
 * @file presenceHelper.js
 * @description Configuración centralizada y funciones auxiliares para el Estado de Presencia
 * de agentes y contactos (Disponible, En reunión, No molestar, En comida, Ausente, Desconectado).
 */

import { CheckCircle2, Users, AlertCircle, Coffee, Clock, CircleDot } from 'lucide-react';

export const ESTADOS_PRESENCIA = {
  disponible: {
    id: 'disponible',
    label: 'Disponible',
    color: '#10b981',
    border: '#059669',
    bg: '#ecfdf5',
    textDark: '#065f46',
    desc: 'Atendiendo normalmente',
    icon: CheckCircle2,
    emoji: '🟢'
  },
  reunion: {
    id: 'reunion',
    label: 'En reunión',
    color: '#f59e0b',
    border: '#d97706',
    bg: '#fffbeb',
    textDark: '#92400e',
    desc: 'En junta o llamada',
    icon: Users,
    emoji: '🟠'
  },
  ocupado: {
    id: 'ocupado',
    label: 'No molestar',
    color: '#ef4444',
    border: '#dc2626',
    bg: '#fef2f2',
    textDark: '#991b1b',
    desc: 'Tareas concentradas',
    icon: AlertCircle,
    emoji: '🔴'
  },
  comida: {
    id: 'comida',
    label: 'En comida',
    color: '#d97706',
    border: '#b45309',
    bg: '#fffbeb',
    textDark: '#78350f',
    desc: 'Almuerzo / Break',
    icon: Coffee,
    emoji: '☕'
  },
  ausente: {
    id: 'ausente',
    label: 'Ausente',
    color: '#64748b',
    border: '#475569',
    bg: '#f8fafc',
    textDark: '#334155',
    desc: 'Fuera del lugar',
    icon: Clock,
    emoji: '⏱️'
  },
  desconectado: {
    id: 'desconectado',
    label: 'Desconectado',
    color: '#94a3b8',
    border: '#64748b',
    bg: '#f1f5f9',
    textDark: '#475569',
    desc: 'Desconectado',
    icon: CircleDot,
    emoji: '⚪'
  }
};

export const LISTA_ESTADOS_PRESENCIA = [
  ESTADOS_PRESENCIA.disponible,
  ESTADOS_PRESENCIA.reunion,
  ESTADOS_PRESENCIA.ocupado,
  ESTADOS_PRESENCIA.comida,
  ESTADOS_PRESENCIA.ausente,
];

/**
 * Obtiene la información completa normalizada de presencia de un usuario/contacto
 */
export function getPresenciaInfo(agenteOrContacto) {
  if (!agenteOrContacto) return ESTADOS_PRESENCIA.desconectado;

  // Si está explícitamente offline
  const estaOnline = Boolean(agenteOrContacto.esta_online);

  // Si tiene un estado de presencia asignado
  const stKey = (agenteOrContacto.estado_presencia || 'disponible').toLowerCase().trim();
  const cfg = ESTADOS_PRESENCIA[stKey] || ESTADOS_PRESENCIA.disponible;

  if (!estaOnline) {
    return {
      ...ESTADOS_PRESENCIA.desconectado,
      estadoReal: stKey,
      estaOnline: false,
      labelConEstado: 'Desconectado',
      mensajePresencia: agenteOrContacto.mensaje_presencia || ''
    };
  }

  return {
    ...cfg,
    estadoReal: stKey,
    estaOnline: true,
    labelConEstado: cfg.label,
    mensajePresencia: agenteOrContacto.mensaje_presencia || ''
  };
}

/**
 * Estilo inline para el punto de presencia sobre un avatar
 */
export function getPresenciaDotStyle(agenteOrContacto, size = 11) {
  const info = getPresenciaInfo(agenteOrContacto);
  return {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: info.color,
    border: '2px solid #ffffff',
    boxShadow: `0 0 0 1px ${info.border}30, 0 1px 3px rgba(0,0,0,0.25)`,
    flexShrink: 0
  };
}
