import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

// ── Catálogo de módulos (espejo del backend) ──────────────────────────────────
export const MODULOS = [
  { id: 'chat',          nombre: 'Chat',           desc: 'Panel de conversaciones y atención al cliente', icono: '💬' },
  { id: 'contactos',     nombre: 'Contactos',       desc: 'Directorio de clientes',                        icono: '👥' },
  { id: 'infracciones',  nombre: 'Infracciones',    desc: 'Registro de infracciones del equipo',           icono: '⚠️' },
  { id: 'dashboard',     nombre: 'Dashboard',       desc: 'Analíticas y métricas del sistema',             icono: '📊' },
  { id: 'usuarios',      nombre: 'Usuarios',        desc: 'Gestión de agentes y cuentas',                  icono: '🔑' },
  { id: 'configuracion', nombre: 'Configuración',   desc: 'Parámetros globales: jornadas, SLA, etc.',      icono: '⚙️' },
  { id: 'etiquetas',     nombre: 'Etiquetas',       desc: 'Catálogo de etiquetas para conversaciones',     icono: '🏷️' },
  { id: 'notas_cierre',  nombre: 'Notas de Cierre', desc: 'Categorías de cierre de conversaciones',        icono: '📝' },
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

  /** ¿Tiene acceso al módulo? Admin siempre sí. Todos pueden ver dashboard. */
  const hasModulo = useCallback((mod) => {
    if (user?.rol === 'admin') return true;
    if (mod === 'dashboard') return true;
    if (!permisos) return false;
    return permisos.modulos?.includes(mod) ?? false;
  }, [user, permisos]);

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

  return { permisos, loading, hasModulo, hasEmpresa, hasArea, filtrarEmpresas, recargar: cargar };
}
