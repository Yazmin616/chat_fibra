import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Layout, Check } from 'lucide-react';
import { MODULOS, EMPRESAS_DEF, AREAS_DEF } from '../../hooks/usePermisos';
import { apiService } from '../../services/api';

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
const PermisosFormPanel = ({ form, areasCustom }) => {
  const [areasList, setAreasList] = useState(areasCustom || AREAS_DEF);

  useEffect(() => {
    if (areasCustom && areasCustom.length > 0) {
      setAreasList(areasCustom);
      return;
    }
    apiService.getAreasSoluciones(null, { catalogo: true })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAreasList(data.map(a => a.nombre_area));
        }
      })
      .catch(() => {});
  }, [areasCustom]);

  const {
    empresas, todasEmpresas, empresasEfectivas,
    toggleTodasEmpresas, toggleEmpresa,
    todasAreasDeEmpresa, toggleTodasAreas, toggleArea, hasArea,
    modulos, toggleModulo,
  } = form;

  return (
    <div className="pe-root" style={{ maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

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
              {areasList.map(area => (
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
        <div className="pe-modulos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))', gap: '10px', maxWidth: '100%', boxSizing: 'border-box' }}>
          {MODULOS.map(mod => {
            const Icono = mod.icono;
            const isChecked = modulos.includes(mod.id);
            return (
              <label
                key={mod.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '12px 14px',
                  background: isChecked ? '#f8fafc' : 'transparent',
                  border: `1px solid ${isChecked ? '#cbd5e1' : 'transparent'}`,
                  borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s'
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleModulo(mod.id)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: isChecked ? '#0f172a' : '#475569' }}>
                    <Icono size={16} style={{ color: isChecked ? '#3b82f6' : '#94a3b8' }} />
                    {mod.nombre}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
                    {mod.desc}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default PermisosFormPanel;
