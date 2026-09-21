import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { MessageSquare, Users, AlertTriangle, LayoutDashboard, Key, Settings, Tags, FileText, Shield, BarChart2, ClipboardList, Megaphone, Wrench, GitBranch } from 'lucide-react';

// ── Catálogo de módulos (espejo del backend) ──────────────────────────────────
export const MODULOS = [
  { id: 'comunicados',   nombre: 'Avisos y Mural',     desc: 'Mural corporativo de avisos, efemérides y cumpleaños', icono: Megaphone },
  { id: 'chat_interno',  nombre: 'Chat Interno',      desc: 'Mensajería interna corporativa entre colaboradores', icono: MessageSquare },
  { id: 'chat',          nombre: 'Chat Clientes',              desc: 'Panel de conversaciones y atención al cliente', icono: MessageSquare },
  { id: 'contactos',     nombre: 'Contactos',          desc: 'Directorio de clientes',                        icono: Users },
  { id: 'infracciones',  nombre: 'Infracciones',       desc: 'Registro de infracciones del equipo',           icono: AlertTriangle },
  { id: 'dashboard',     nombre: 'Dashboard',          desc: 'Analíticas y métricas del sistema',             icono: LayoutDashboard },
  { id: 'nps',           nombre: 'Dashboard de Staff', desc: 'Métricas de rendimiento y NPS del staff',       icono: BarChart2 },
  { id: 'soluciones',    nombre: 'Soluciones Staff',   desc: 'Historial de cierres y soluciones del staff',   icono: ClipboardList },
  { id: 'usuarios',      nombre: 'Usuarios',           desc: 'Gestión de agentes y cuentas',                  icono: Key },
  { id: 'configuracion', nombre: 'Configuración',     desc: 'Parámetros globales: jornadas, SLA, etc.',      icono: Settings },
  { id: 'etiquetas',     nombre: 'Etiquetas',          desc: 'Catálogo de etiquetas para conversaciones',     icono: Tags },
  { id: 'notas_cierre',  nombre: 'Notas de Cierre',    desc: 'Categorías de cierre de conversaciones',        icono: FileText },
  { id: 'flujo_bot',     nombre: 'Flujo del Bot',      desc: 'Diseñador de respuestas y menú interactivo del bot', icono: GitBranch },
  { id: 'equipos',       nombre: 'Equipos',            desc: 'Gestión de equipos y coordinadores de área',    icono: Shield },
  { id: 'tickets',       nombre: 'Tickets / Soporte TI', desc: 'Levantar y consultar solicitudes de soporte y tareas TI', icono: Wrench },
];

export const EMPRESAS_DEF = [
  { id: 'fibratec',   label: 'Fibratec' },
  { id: 'compusemmm', label: 'Compusemmm' },
];

export const AREAS_DEF = [
  'NOC (Centro de Operaciones de Red)',
  'Dirección General',
  'Recursos Humanos (RH)',
  'Administración y Finanzas',
  'Contabilidad',
  'Sistemas / TI',
  'Soporte Técnico',
  'Ventas',
  'Cobranza',
  'Planta Externa / Fibra Óptica',
  'Instalaciones y Mantenimiento',
  'Almacén y Logística',
  'Atención a Clientes',
  'General',
];

// Permisos vacíos por defecto (usuario sin permisos definidos)
const EMPTY = { empresas: [], areas: [], modulos: [] };

// Permisos de admin por defecto (solo cuando no hay configuración explícita en BD)
const ADMIN_PERMISOS = {
  empresas: ['__todas__'],
  areas:    [{ empresa_id: '__todas__', areas: ['__todas__'] }],
  modulos:  MODULOS.map(m => m.id),
};

/**
 * Hook que carga y expone los permisos del usuario autenticado.
 * - Se actualiza en tiempo real via Socket.IO (evento 'permisos_actualizados').
 * - Respeta estrictamente los módulos configurados en BD para cualquier usuario.
 *
 * @param {object} user  - Objeto de usuario del JWT ({ id, rol, ... })
 * @param {object} socket - Instancia del Socket.IO del cliente (puede ser null)
 */
export function usePermisos(user, socket) {
  const [permisos, setPermisos] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const cargar = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiService.getMisPermisos();
      if (data && Array.isArray(data.modulos) && data.modulos.length > 0) {
        setPermisos(data);
      } else if (user.rol === 'admin') {
        setPermisos(ADMIN_PERMISOS);
      } else {
        setPermisos(data || EMPTY);
      }
    } catch {
      if (user.rol === 'admin') {
        setPermisos(ADMIN_PERMISOS);
      } else {
        setPermisos(EMPTY);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { cargar(); }, [cargar]);

  // Recargar cuando el backend notifica que este usuario fue modificado
  useEffect(() => {
    if (!socket || !user) return;
    const handler = ({ usuario_id }) => {
      if (Number(usuario_id) === Number(user.id)) cargar();
    };
    socket.on('permisos_actualizados', handler);
    return () => socket.off('permisos_actualizados', handler);
  }, [socket, user, cargar]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Debe declararse ANTES de hasModulo para evitar "before initialization"
  const esCoordinador = permisos?.es_coordinador || user?.es_coordinador || false;

  /** ¿Tiene acceso al módulo? Respeta estrictamente la lista de permisos guardada */
  const hasModulo = useCallback((mod) => {
    if (!permisos) return false;

    // Si tiene lista de módulos explícita en BD, respetarla estrictamente
    if (Array.isArray(permisos.modulos) && permisos.modulos.length > 0) {
      return permisos.modulos.includes(mod);
    }

    // Fallback: solo si no tiene configuración explícita y es admin, ve todo
    if (user?.rol === 'admin') return true;

    // Fallbacks para roles sin configuración explícita guardada
    if (mod === 'comunicados' || mod === 'tickets') return true;
    if (user?.rol === 'colaborador' && mod === 'chat_interno') return true;
    if (esCoordinador && (mod === 'nps' || mod === 'soluciones' || mod === 'configuracion' || mod === 'equipos')) return true;
    if (mod === 'soluciones' && user?.rol === 'asesor' && permisos?.modulos?.includes('chat')) return true;

    return false;
  }, [user, permisos, esCoordinador]);

  /** ¿Tiene acceso a la empresa? */
  const hasEmpresa = useCallback((empresaId) => {
    if (!permisos) return false;
    if (Array.isArray(permisos.empresas) && permisos.empresas.length > 0) {
      return (
        permisos.empresas.includes('__todas__') ||
        permisos.empresas.includes(empresaId)
      );
    }
    if (user?.rol === 'admin') return true;
    return false;
  }, [user, permisos]);

  /** Filtra un array de empresa_ids según permisos del usuario. */
  const filtrarEmpresas = useCallback((todas) => {
    if (!permisos) return [];
    if (Array.isArray(permisos.empresas) && permisos.empresas.length > 0) {
      if (permisos.empresas.includes('__todas__')) return todas;
      return todas.filter(e => permisos.empresas.includes(e));
    }
    if (user?.rol === 'admin') return todas;
    return [];
  }, [user, permisos]);

  /** ¿Tiene acceso al área dentro de la empresa? */
  const hasArea = useCallback((empresaId, area) => {
    if (!permisos) return false;
    if (Array.isArray(permisos.areas) && permisos.areas.length > 0) {
      const entrada = permisos.areas.find(
        a => a.empresa_id === empresaId || a.empresa_id === '__todas__'
      );
      if (!entrada) return false;
      return entrada.areas?.includes('__todas__') || entrada.areas?.includes(area);
    }
    if (user?.rol === 'admin') return true;
    return false;
  }, [user, permisos]);

  return { permisos, loading, hasModulo, hasEmpresa, hasArea, filtrarEmpresas, esCoordinador, recargar: cargar };
}
