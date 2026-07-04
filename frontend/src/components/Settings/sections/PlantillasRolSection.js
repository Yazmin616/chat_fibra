import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronRight, Check, AlertCircle, Users, RefreshCw, Save } from 'lucide-react';
import { apiService } from '../../../services/api';
import { usePermisosForm } from '../../../hooks/usePermisosForm';
import PermisosFormPanel from '../../Agents/PermisosFormPanel';

const ROLES_DEF = [
  { id: 'admin',  label: 'Administrador', desc: 'Acceso total al sistema',              color: '#dc2626', bg: '#fef2f2' },
  { id: 'asesor', label: 'Asesor',        desc: 'Atención a clientes en chat',          color: '#2563eb', bg: '#eff6ff' },
  { id: 'ti',     label: 'Soporte TI',    desc: 'Infracciones, dashboard y técnico',    color: '#7c3aed', bg: '#f5f3ff' },
];

function RolCard({ rol, activo, onClick }) {
  return (
    <button
      type="button"
      className={`plt-rol-card${activo ? ' plt-rol-card--active' : ''}`}
      onClick={onClick}
      style={{ '--rol-color': rol.color, '--rol-bg': rol.bg }}
    >
      <span className="plt-rol-dot" />
      <div className="plt-rol-info">
        <span className="plt-rol-label">{rol.label}</span>
        <span className="plt-rol-desc">{rol.desc}</span>
      </div>
      <ChevronRight size={16} className="plt-rol-arrow" />
    </button>
  );
}

const PlantillasRolSection = ({ config, onSave }) => {
  const [rolActivo,   setRolActivo]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [applying,    setApplying]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [lastUpdated, setLastUpdated] = useState({});

  const form = usePermisosForm();

  // Cargar metadatos de todas las plantillas (para mostrar "última actualización")
  const cargarMeta = useCallback(async () => {
    try {
      const rows = await apiService.getRolTemplates();
      const map  = {};
      for (const row of rows) map[row.rol] = row;
      setLastUpdated(map);
    } catch (_) {}
  }, []);

  useEffect(() => { cargarMeta(); }, [cargarMeta]);

  const abrirRol = async (rolId) => {
    if (rolActivo === rolId) { setRolActivo(null); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const tpl = await apiService.getRolTemplate(rolId);
      form.load(tpl);
      setRolActivo(rolId);
    } catch (e) {
      // Si no existe aún, inicializar vacío
      form.load({ empresas: [], areas: [], modulos: [] });
      setRolActivo(rolId);
    } finally {
      setLoading(false);
    }
  };

  const guardar = async () => {
    if (!rolActivo) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiService.setRolTemplate(rolActivo, form.serialize());
      setSuccess('Plantilla guardada. Los agentes nuevos con este rol usarán estos permisos.');
      setTimeout(() => setSuccess(''), 5000);
      await cargarMeta();
    } catch (e) { setError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const aplicarATodos = async () => {
    if (!rolActivo) return;
    const rolDef = ROLES_DEF.find(r => r.id === rolActivo);
    const ok = window.confirm(
      `¿Aplicar esta plantilla a TODOS los usuarios con rol "${rolDef?.label || rolActivo}"?\n\n` +
      `Sus permisos individuales serán REEMPLAZADOS por esta plantilla.\n` +
      `Esta acción se registra en el log de auditoría.`
    );
    if (!ok) return;
    setApplying(true); setError(''); setSuccess('');
    try {
      const result = await apiService.applyRolTemplate(rolActivo);
      setSuccess(`Plantilla aplicada a ${result.usuarios_afectados} usuario(s) con rol "${rolDef?.label || rolActivo}".`);
      setTimeout(() => setSuccess(''), 6000);
    } catch (e) { setError(e.message || 'Error al aplicar'); }
    finally { setApplying(false); }
  };

  return (
    <div className="plt-root">
      <div className="cfg-section-header">
        <h2>Plantillas de permisos por rol</h2>
        <p>Define qué empresas, áreas y módulos tiene acceso cada rol por defecto al crear un agente nuevo.</p>
      </div>

      {/* Lista de roles */}
      <div className="plt-roles-list">
        {ROLES_DEF.map(rol => (
          <div key={rol.id} className="plt-rol-wrap">
            <RolCard
              rol={rol}
              activo={rolActivo === rol.id}
              onClick={() => abrirRol(rol.id)}
            />
            {lastUpdated[rol.id]?.updated_at && (
              <span className="plt-last-update">
                Actualizado {new Date(lastUpdated[rol.id].updated_at).toLocaleDateString('es-MX')}
              </span>
            )}

            {/* Editor inline del rol activo */}
            {rolActivo === rol.id && (
              <div className="plt-editor">
                {loading ? (
                  <div className="pe-loading"><RefreshCw size={15} className="pe-spin" /> Cargando plantilla…</div>
                ) : (
                  <>
                    <PermisosFormPanel form={form} />

                    {error   && <div className="pe-error"><AlertCircle size={14} /> {error}</div>}
                    {success && <div className="pe-ok"><Check size={14} /> {success}</div>}

                    <div className="plt-actions">
                      <button
                        type="button"
                        className="pe-btn-save"
                        onClick={guardar}
                        disabled={saving || applying}
                      >
                        {saving ? 'Guardando…' : <><Save size={14} /> Guardar plantilla</>}
                      </button>
                      <button
                        type="button"
                        className="plt-btn-apply"
                        onClick={aplicarATodos}
                        disabled={saving || applying}
                        title="Aplica esta plantilla a los usuarios existentes con este rol (sobrescribe sus permisos actuales)"
                      >
                        {applying ? 'Aplicando…' : <><Users size={14} /> Aplicar a usuarios actuales del rol</>}
                      </button>
                    </div>
                    <p className="plt-apply-hint">
                      "Guardar plantilla" solo afecta a agentes nuevos. "Aplicar a usuarios actuales" también
                      actualiza los permisos de los agentes existentes con este rol.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlantillasRolSection;
