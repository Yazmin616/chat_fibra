import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { MessageSquare, Users, AlertTriangle, LayoutDashboard, Key, Settings, Tags, FileText, Shield, BarChart2, ClipboardList } from 'lucide-react';

// ── Catálogo de módulos (espejo del backend) ──────────────────────────────────
export const MODULOS = [
  { id: 'chat',          nombre: 'Chat',              desc: 'Panel de conversaciones y atención al cliente', icono: MessageSquare },
  { id: 'contactos',     nombre: 'Contactos',          desc: 'Directorio de clientes',                        icono: Users },
  { id: 'infracciones',  nombre: 'Infracciones',       desc: 'Registro de infracciones del equipo',           icono: AlertTriangle },
  { id: 'dashboard',     nombre: 'Dashboard',          desc: 'Analíticas y métricas del sistema',             icono: LayoutDashboard },
  { id: 'nps',           nombre: 'Dashboard de Staff', desc: 'Métricas de rendimiento y NPS del staff',       icono: BarChart2 },
  { id: 'soluciones',    nombre: 'Soluciones Staff',   desc: 'Historial de cierres y soluciones del staff',   icono: ClipboardList },
  { id: 'usuarios',      nombre: 'Usuarios',           desc: 'Gestión de agentes y cuentas',                  icono: Key },
  { id: 'configuracion', nombre: 'Configuración',     desc: 'Parámetros globales: jornadas, SLA, etc.',      icono: Settings },
  { id: 'etiquetas',     nombre: 'Etiquetas',          desc: 'Catálogo de etiquetas para conversaciones',     icono: Tags },
  { id: 'notas_cierre',  nombre: 'Notas de Cierre',    desc: 'Categorías de cierre de conversaciones',        icono: FileText },
  { id: 'equipos',       nombre: 'Equipos',            desc: 'Gestión de equipos y coordinadores de área',    icono: Shield },
];

export const EMPRESAS_DEF = [
  { id: 'fibratec',   label: 'Fibratec' },
  { id: 'compusemmm', label: 'Compusemmm' },
];

export const AREAS_DEF = ['Soporte Técnico', 'Ventas', 'Cobranza'];

// Permisos vacíos por defecto (usuario sin permisos definidos)
const EMPTY = { empresas: [], areas: [], modulos: [] };

// Permisos de admin (bypass total)
const ADMIN_PERMISOS = {
  empresas: ['__todas__'],
  areas:    [{ empresa_id: '__todas__', areas: ['__todas__'] }],
  modulos:  MODULOS.map(m => m.id),
};

/**
 * Hook que carga y expone los permisos del usuario autenticado.
 * - Se actualiza en tiempo real via Socket.IO (evento 'permisos_actualizados').
 * - El admin recibe el set completo directamente sin consultar la BD.
 *
 * @param {object} user  - Objeto de usuario del JWT ({ id, rol, ... })
 * @param {object} socket - Instancia del Socket.IO del cliente (puede ser null)
 */
export function usePermisos(user, socket) {
  const [permisos, setPermisos] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const cargar = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    if (user.rol === 'admin') {
      setPermisos(ADMIN_PERMISOS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiService.getMisPermisos();
      setPermisos(data || EMPTY);
    } catch {
      setPermisos(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { cargar(); }, [cargar]);

  // Recargar cuando el backend notifica que este usuario fue modificado
  useEffect(() => {
    if (!socket || !user) return;
    const handler = ({ usuario_id }) => {
      if (usuario_id === user.id) cargar();
    };
    socket.on('permisos_actualizados', handler);
    return () => socket.off('permisos_actualizados', handler);
  }, [socket, user, cargar]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Debe declararse ANTES de hasModulo para evitar "before initialization"
  const esCoordinador = permisos?.es_coordinador || user?.es_coordinador || false;

  /** ¿Tiene acceso al módulo? Admin siempre sí. Coordinadores ven nps, soluciones y configuracion. */
  const hasModulo = useCallback((mod) => {
    if (user?.rol === 'admin') return true;
    // Coordinadores siempre ven sus módulos de staff y su panel de configuración
    if ((mod === 'nps' || mod === 'soluciones' || mod === 'configuracion') && esCoordinador) return true;
    // Asesores normales también ven sus propias soluciones
    if (mod === 'soluciones') return true;
    if (!permisos) return false;
    return permisos.modulos?.includes(mod) ?? false;
  }, [user, permisos, esCoordinador]);

  /** ¿Tiene acceso a la empresa? */
  const hasEmpresa = useCallback((empresaId) => {
    if (user?.rol === 'admin') return true;
    if (!permisos) return false;
    return (
      permisos.empresas?.includes('__todas__') ||
      permisos.empresas?.includes(empresaId)
    );
  }, [user, permisos]);

  /** Filtra un array de empresa_ids según permisos del usuario. */
  const filtrarEmpresas = useCallback((todas) => {
    if (user?.rol === 'admin') return todas;
    if (!permisos) return [];
    if (permisos.empresas?.includes('__todas__')) return todas;
    return todas.filter(e => permisos.empresas?.includes(e));
  }, [user, permisos]);

  /** ¿Tiene acceso al área dentro de la empresa? */
  const hasArea = useCallback((empresaId, area) => {
    if (user?.rol === 'admin') return true;
    if (!permisos) return false;
    const entrada = permisos.areas?.find(
      a => a.empresa_id === empresaId || a.empresa_id === '__todas__'
    );
    if (!entrada) return false;
    return entrada.areas?.includes('__todas__') || entrada.areas?.includes(area);
  }, [user, permisos]);

  return { permisos, loading, hasModulo, hasEmpresa, hasArea, filtrarEmpresas, esCoordinador, recargar: cargar };
}
