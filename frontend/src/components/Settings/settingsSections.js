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

import { Bot, MessageSquare, Timer, CalendarDays, Wrench, ShieldCheck, BookKey, Menu } from 'lucide-react';
import InactividadBotSection    from './sections/InactividadBotSection';
import InactividadHumanaSection from './sections/InactividadHumanaSection';
import SLASection               from './sections/SLASection';
import TurnosSection            from './sections/TurnosSection';
import MantenimientoSection     from './sections/MantenimientoSection';
import PlantillasRolSection     from './sections/PlantillasRolSection';
import PalabrasClaveBotSection  from './sections/PalabrasClaveBotSection';
import PlantillasBotSection     from './sections/PlantillasBotSection';
import MenusBotSection          from './sections/MenusBotSection';

export const SECTIONS = [
  {
    id:          'inactividad-bot',
    label:       'Inactividad del bot',
    icon:        Bot,
    description: 'Cierre del menú automático',
    component:   InactividadBotSection,
  },
  {
    id:          'inactividad-humana',
    label:       'Atención humana',
    icon:        MessageSquare,
    description: 'Escalada cuando el cliente no responde',
    component:   InactividadHumanaSection,
  },
  {
    id:          'sla-agente',
    label:       'SLA del agente',
    icon:        Timer,
    description: 'Tiempo máximo de respuesta del agente',
    component:   SLASection,
  },
  {
    id:          'turnos',
    label:       'Turnos por área',
    icon:        CalendarDays,
    description: 'Turnos, festivos y mensajes automáticos',
    component:   TurnosSection,
  },
  {
    id:          'mantenimiento',
    label:       'Mantenimiento',
    icon:        Wrench,
    description: 'Mensaje mientras el sistema está en mantenimiento',
    component:   MantenimientoSection,
  },
  {
    id:          'plantillas-bot',
    label:       'Mensajes del Bot',
    icon:        Bot,
    description: 'Plantillas de los mensajes automáticos',
    component:   PlantillasBotSection,
    adminOnly:   true,
  },
  {
    id:          'menus-bot',
    label:       'Menús Interactivos',
    icon:        Menu,
    description: 'Botones de WhatsApp enviados por el bot',
    component:   MenusBotSection,
    adminOnly:   true,
  },
  {
    id:          'plantillas-rol',
    label:       'Plantillas de rol',
    icon:        ShieldCheck,
    description: 'Permisos por defecto al crear un agente',
    component:   PlantillasRolSection,
    adminOnly:   true,
  },
  {
    id:          'palabras-clave-bot',
    label:       'Palabras clave del bot',
    icon:        BookKey,
    description: 'Mapa de frases → intención del bot',
    component:   PalabrasClaveBotSection,
    adminOnly:   true,
  },
];

export const DEFAULT_SECTION_ID = SECTIONS[0].id;
