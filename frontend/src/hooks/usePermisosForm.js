import { useState } from 'react';
import { EMPRESAS_DEF, AREAS_DEF } from './usePermisos';

/**
 * Hook de estado para el formulario de permisos (3 dimensiones).
 * Puede iniciarse con valores vacíos o pre-cargados.
 * Usado por PermisosEditor, PermisosFormPanel (creación) y PlantillasRolSection.
 */
export function usePermisosForm(initial = {}) {
  const [empresas, setEmpresas]  = useState(() => initial.empresas || []);
  const [areas,    setAreasMap]  = useState(() => {
    const map = {};
    for (const e of (initial.areas || [])) map[e.empresa_id] = e.areas || [];
    return map;
  });
  const [modulos, setModulos] = useState(() => initial.modulos || []);

  const todasEmpresas     = empresas.includes('__todas__');
  const empresasEfectivas = todasEmpresas ? EMPRESAS_DEF.map(e => e.id) : empresas;

  // Carga un nuevo estado desde un objeto { empresas, areas[], modulos }
  const load = (data) => {
    setEmpresas(data.empresas || []);
    const map = {};
    for (const e of (data.areas || [])) map[e.empresa_id] = e.areas || [];
    setAreasMap(map);
    setModulos(data.modulos || []);
  };

  // ── Empresas ───────────────────────────────────────────────────────────────

  const toggleTodasEmpresas = () => {
    if (todasEmpresas) {
      setEmpresas([EMPRESAS_DEF[0].id]);
      setAreasMap({ [EMPRESAS_DEF[0].id]: ['__todas__'] });
    } else {
      setEmpresas(['__todas__']);
      setAreasMap({ '__todas__': ['__todas__'] });
    }
  };

  const toggleEmpresa = (id) => {
    if (todasEmpresas) return;
    const next = empresas.includes(id)
      ? empresas.filter(e => e !== id)
      : [...empresas, id];
    setEmpresas(next.length ? next : [id]);
    if (!next.includes(id)) {
      setAreasMap(prev => { const a = { ...prev }; delete a[id]; return a; });
    } else if (!areas[id]) {
      setAreasMap(prev => ({ ...prev, [id]: ['__todas__'] }));
    }
  };

  // ── Áreas ──────────────────────────────────────────────────────────────────

  const todasAreasDeEmpresa = (empId) => {
    const key = todasEmpresas ? '__todas__' : empId;
    return (areas[key] || []).includes('__todas__');
  };

  const toggleTodasAreas = (empId) => {
    const key = todasEmpresas ? '__todas__' : empId;
    setAreasMap(prev => ({
      ...prev,
      [key]: todasAreasDeEmpresa(empId) ? [AREAS_DEF[0]] : ['__todas__'],
    }));
  };

  const toggleArea = (empId, area) => {
    if (todasAreasDeEmpresa(empId)) return;
    const key = todasEmpresas ? '__todas__' : empId;
    const cur  = areas[key] || [];
    const next = cur.includes(area) ? cur.filter(a => a !== area) : [...cur, area];
    setAreasMap(prev => ({ ...prev, [key]: next.length ? next : [area] }));
  };

  const hasArea = (empId, area) => {
    if (todasAreasDeEmpresa(empId)) return true;
    const key = todasEmpresas ? '__todas__' : empId;
    return (areas[key] || []).includes(area);
  };

  // ── Módulos ────────────────────────────────────────────────────────────────

  const toggleModulo = (id) =>
    setModulos(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  // ── Serializar al formato del backend ─────────────────────────────────────

  const serialize = () => {
    const areasPayload = todasEmpresas
      ? [{ empresa_id: '__todas__', areas: areas['__todas__'] || ['__todas__'] }]
      : empresas.map(empId => ({ empresa_id: empId, areas: areas[empId] || ['__todas__'] }));
    return { empresas, areas: areasPayload, modulos };
  };

  return {
    empresas, areas, modulos,
    todasEmpresas, empresasEfectivas,
    toggleTodasEmpresas, toggleEmpresa,
    todasAreasDeEmpresa, toggleTodasAreas, toggleArea, hasArea,
    toggleModulo,
    serialize, load,
  };
}
