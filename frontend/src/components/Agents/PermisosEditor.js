import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Check, AlertCircle, RefreshCw, Clock, RotateCcw } from 'lucide-react';
import { apiService } from '../../services/api';
import { usePermisosForm } from '../../hooks/usePermisosForm';
import PermisosFormPanel from './PermisosFormPanel';

const PermisosEditor = ({ agenteId, agente }) => {
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [resetting,     setResetting]     = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [log,           setLog]           = useState([]);

  const form = usePermisosForm();

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiService.getPermisosUsuario(agenteId);
      form.load(data);
      setLog(data.log || []);
    } catch (e) { setError(e.message || 'Error al cargar permisos'); }
    finally { setLoading(false); }
  }, [agenteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiService.setPermisosUsuario(agenteId, form.serialize());
      setSuccess('Permisos guardados');
      setTimeout(() => setSuccess(''), 3000);
      await cargar();
    } catch (e) { setError(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const restablecerPlantilla = async () => {
    if (!agente?.rol) return;
    setResetting(true); setError(''); setSuccess('');
    try {
      const tpl = await apiService.getRolTemplate(agente.rol);
      form.load(tpl);
      setSuccess('Plantilla cargada — guarda para aplicar los cambios');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) { setError(e.message || 'Error al cargar plantilla'); }
    finally { setResetting(false); }
  };

  if (loading) {
    return <div className="pe-loading"><RefreshCw size={16} className="pe-spin" /> Cargando permisos…</div>;
  }

  return (
    <div>
      {/* Acción rápida: restablecer a la plantilla del rol */}
      {agente?.rol && (
        <div className="pe-rol-hint">
          <span>Rol: <strong>{agente.rol}</strong></span>
          <button
            type="button"
            className="pe-btn-reset"
            onClick={restablecerPlantilla}
            disabled={resetting}
            title={`Carga los permisos por defecto del rol "${agente.rol}" (no guarda automáticamente)`}
          >
            <RotateCcw size={13} />
            {resetting ? 'Cargando…' : 'Restablecer a plantilla del rol'}
          </button>
        </div>
      )}

      <PermisosFormPanel form={form} />

      {error   && <div className="pe-error"><AlertCircle size={14} /> {error}</div>}
      {success && <div className="pe-ok"><Check size={14} /> {success}</div>}

      <div className="pe-footer">
        <button className="pe-btn-save" onClick={guardar} disabled={saving}>
          {saving ? 'Guardando…' : <><Shield size={14} /> Guardar permisos</>}
        </button>
      </div>

      {log.length > 0 && (
        <div className="pe-log">
          <div className="pe-log-title"><Clock size={13} /> Historial reciente</div>
          {log.slice(0, 5).map(entry => (
            <div key={entry.id} className="pe-log-row">
              <span className="pe-log-admin">{entry.admin_nombre}</span>
              <span className="pe-log-date">
                {new Date(entry.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PermisosEditor;
