/**
 * @file settingsSections.js
 * @description Registro central de todas las secciones del panel de configuración.
 *
 * Para AGREGAR una nueva sección:
 *   1. Crear el componente en ./sections/MiNuevaSección.js
 *      → Recibe props: { config, onSave, setDirty }
 *   2. Importarlo aquí
 *   3. Agregar una entrada al array SECTIONS con { id, label, icon, description, component }
 *
 * El shell (SettingsView.js) lee este array para generar automáticamente
 * el submenú lateral y el enrutamiento por hash, sin tocar ningún otro archivo.
 *
 * Ejemplo de entrada futura:
 *   {
 *     id:          'notificaciones',
 *     label:       'Notificaciones',
 *     icon:        '🔔',
 *     description: 'Alertas y correos al equipo',
 *     component:   NotificacionesSection,
 *   }
 */

import InactividadBotSection    from './sections/InactividadBotSection';
import InactividadHumanaSection from './sections/InactividadHumanaSection';
import SLASection               from './sections/SLASection';
import TurnosSection            from './sections/TurnosSection';

export const SECTIONS = [
  {
    id:          'inactividad-bot',
    label:       'Inactividad del bot',
    icon:        '🤖',
    description: 'Cierre del menú automático',
    component:   InactividadBotSection,
  },
  {
    id:          'inactividad-humana',
    label:       'Atención humana',
    icon:        '💬',
    description: 'Escalada cuando el cliente no responde',
    component:   InactividadHumanaSection,
  },
  {
    id:          'sla-agente',
    label:       'SLA del agente',
    icon:        '⏱',
    description: 'Tiempo máximo de respuesta del agente',
    component:   SLASection,
  },
  {
    id:          'turnos',
    label:       'Turnos por área',
    icon:        '📅',
    description: 'Turnos, festivos y mensajes automáticos',
    component:   TurnosSection,
  },
];

export const DEFAULT_SECTION_ID = SECTIONS[0].id;
