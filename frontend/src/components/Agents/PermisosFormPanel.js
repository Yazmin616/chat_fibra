import React from 'react';
import { Building2, MapPin, Layout, Check } from 'lucide-react';
import { MODULOS, EMPRESAS_DEF, AREAS_DEF } from '../../hooks/usePermisos';

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="pe-section-header">
      <Icon size={16} className="pe-section-icon" />
      <div>
        <span className="pe-section-title">{title}</span>
        {subtitle && <span className="pe-section-sub">{subtitle}</span>}
      </div>
    </div>
  );
}

function CheckRow({ label, desc, checked, onChange, disabled }) {
  return (
    <label className={`pe-check-row${disabled ? ' pe-check-row--disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="pe-check-input"
      />
      <span className="pe-check-box">{checked && <Check size={10} strokeWidth={3} />}</span>
      <span className="pe-check-label">
        {label}
        {desc && <span className="pe-check-desc">{desc}</span>}
      </span>
    </label>
  );
}

/**
 * Panel puro de UI para editar permisos (3 dimensiones).
 * Recibe el objeto retornado por usePermisosForm() como prop `form`.
 */
const PermisosFormPanel = ({ form }) => {
  const {
    empresas, todasEmpresas, empresasEfectivas,
    toggleTodasEmpresas, toggleEmpresa,
    todasAreasDeEmpresa, toggleTodasAreas, toggleArea, hasArea,
    modulos, toggleModulo,
  } = form;

  return (
    <div className="pe-root">

      {/* ── EMPRESAS ───────────────────────────────────────────────────────── */}
      <div className="pe-section">
        <SectionHeader
          icon={Building2}
          title="Empresas"
          subtitle="¿A qué empresas puede atender este usuario?"
        />
        <div className="pe-checks">
          <CheckRow
            label="Todas las empresas"
            desc="Acceso a todas las empresas actuales y futuras"
            checked={todasEmpresas}
            onChange={toggleTodasEmpresas}
          />
          {EMPRESAS_DEF.map(emp => (
            <CheckRow
              key={emp.id}
              label={emp.label}
              checked={empresas.includes(emp.id) || todasEmpresas}
              onChange={() => toggleEmpresa(emp.id)}
              disabled={todasEmpresas}
            />
          ))}
        </div>
      </div>

      {/* ── ÁREAS (una sección por empresa visible) ────────────────────────── */}
      {(todasEmpresas ? ['__todas__'] : empresasEfectivas).map(empId => {
        const label = empId === '__todas__'
          ? 'Todas las empresas'
          : EMPRESAS_DEF.find(e => e.id === empId)?.label || empId;
        return (
          <div key={empId} className="pe-section pe-section--area">
            <SectionHeader
              icon={MapPin}
              title={`Áreas — ${label}`}
              subtitle="¿Qué áreas puede atender en esta empresa?"
            />
            <div className="pe-checks">
              <CheckRow
                label="Todas las áreas"
                desc="Incluye áreas que se agreguen en el futuro"
                checked={todasAreasDeEmpresa(empId)}
                onChange={() => toggleTodasAreas(empId)}
              />
              {AREAS_DEF.map(area => (
                <CheckRow
                  key={area}
                  label={area}
                  checked={hasArea(empId, area)}
                  onChange={() => toggleArea(empId, area)}
                  disabled={todasAreasDeEmpresa(empId)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* ── MÓDULOS ────────────────────────────────────────────────────────── */}
      <div className="pe-section">
        <SectionHeader
          icon={Layout}
          title="Módulos del sistema"
          subtitle="¿A qué secciones puede acceder?"
        />
        <div className="pe-modulos-grid">
          {MODULOS.map(mod => (
            <label
              key={mod.id}
              className={`pe-modulo-card${modulos.includes(mod.id) ? ' pe-modulo-card--on' : ''}`}
            >
              <input
                type="checkbox"
                checked={modulos.includes(mod.id)}
                onChange={() => toggleModulo(mod.id)}
                className="pe-modulo-input"
              />
              <span className="pe-modulo-icono">{mod.icono}</span>
              <span className="pe-modulo-nombre">{mod.nombre}</span>
              <span className="pe-modulo-desc">{mod.desc}</span>
              {modulos.includes(mod.id) && (
                <span className="pe-modulo-check"><Check size={11} strokeWidth={3} /></span>
              )}
            </label>
          ))}
        </div>
      </div>

    </div>
  );
};

export default PermisosFormPanel;
