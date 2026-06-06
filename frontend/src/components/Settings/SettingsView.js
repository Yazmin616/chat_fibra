/**
 * @file SettingsView.js
 * @description Shell del panel de configuración.
 *
 * Responsabilidades:
 *   - Renderizar el submenú lateral con todas las secciones de SECTIONS.
 *   - Gestionar la sección activa mediante window.location.hash
 *     (ej. #config-jornada), para que la URL refleje la sección
 *     y el botón Atrás del navegador funcione.
 *   - Intercepción de cambios sin guardar: pide confirmación antes
 *     de navegar a otra sección si hay cambios pendientes.
 *   - Pasar { config, onSave, setDirty } a la sección activa.
 *
 * Para agregar una sección nueva: editar ÚNICAMENTE settingsSections.js.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SECTIONS, DEFAULT_SECTION_ID } from './settingsSections';

// Lee el hash de la URL y lo mapea a un ID de sección válido.
function getSectionFromHash() {
  const raw = window.location.hash.replace('#', '');
  const found = SECTIONS.find(s => `config-${s.id}` === raw);
  return found ? found.id : DEFAULT_SECTION_ID;
}

const SettingsView = ({ config, onSave }) => {
  const [activeId, setActiveId] = useState(getSectionFromHash);

  // dirtyRef: escrito por la sección activa, leído por el shell al navegar.
  const dirtyRef = useRef(false);
  const setDirty = useCallback((v) => { dirtyRef.current = v; }, []);

  // Sincronizar estado activo con cambios de hash (botón Atrás / Adelante).
  useEffect(() => {
    const onHash = () => {
      const id = getSectionFromHash();
      if (id !== activeId) {
        dirtyRef.current = false;
        setActiveId(id);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [activeId]);

  const navigate = useCallback((id) => {
    if (id === activeId) return;
    if (dirtyRef.current) {
      if (!window.confirm('Tienes cambios sin guardar en esta sección. ¿Cambiar de sección?')) {
        return;
      }
    }
    dirtyRef.current = false;
    window.location.hash = `config-${id}`;
    setActiveId(id);
  }, [activeId]);

  const activeSection = SECTIONS.find(s => s.id === activeId) || SECTIONS[0];
  const ActiveComponent = activeSection.component;

  return (
    <div className="settings-view cfg-shell">

      {/* ── Submenú lateral ──────────────────────────────────────────────── */}
      <nav className="cfg-sidebar">
        <div className="cfg-sidebar-header">
          <span className="cfg-sidebar-title">Configuración</span>
        </div>

        <ul className="cfg-nav" role="menu">
          {SECTIONS.map(section => (
            <li key={section.id} role="none">
              <button
                role="menuitem"
                className={`cfg-nav-item${section.id === activeId ? ' cfg-nav-item--active' : ''}`}
                onClick={() => navigate(section.id)}
                aria-current={section.id === activeId ? 'page' : undefined}
              >
                <span className="cfg-nav-icon" aria-hidden="true">{section.icon}</span>
                <span className="cfg-nav-text">
                  <span className="cfg-nav-label">{section.label}</span>
                  <span className="cfg-nav-desc">{section.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Contenido de la sección activa ────────────────────────────────── */}
      {/*  key={activeId} fuerza remount al cambiar de sección,          */}
      {/*  inicializando el estado local desde config fresco.              */}
      <div className="cfg-content">
        <ActiveComponent
          key={activeId}
          config={config}
          onSave={onSave}
          setDirty={setDirty}
        />
      </div>

    </div>
  );
};

export default SettingsView;
