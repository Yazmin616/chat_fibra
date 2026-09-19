import React, { useState, useRef, useEffect } from 'react';
import { Camera, User, Shield, Eye, EyeOff, Lock, Mail, AtSign, Briefcase, Users, KeyRound, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { apiService, resolveAvatar } from '../../services/api';
import { usePermisosForm } from '../../hooks/usePermisosForm';
import PermisosFormPanel from './PermisosFormPanel';
import { AREAS_DEF } from '../../hooks/usePermisos';

const AREAS = AREAS_DEF;

const generarClaveTemporal = () => `Fibri_${Math.floor(1000 + Math.random() * 9000)}`;

const AgentForm = ({ agente, onSubmit, onClose }) => {
  const esEdicion = Boolean(agente);

  const [formData, setFormData] = useState({
    usuario:              agente?.usuario              ?? '',
    nombre:               agente?.nombre               ?? '',
    email:                agente?.email                ?? '',
    password:             esEdicion ? '' : generarClaveTemporal(),
    rol:                  agente?.rol                  ?? 'colaborador',
    area:                 agente?.area                 ?? 'Ventas',
    coordinador_id:       agente?.coordinador_id       ?? '',
    puede_recuperar_auto: agente?.puede_recuperar_auto ?? false,
  });
  const [showPassword,          setShowPassword]          = useState(!esEdicion);
  const [submitting,            setSubmitting]            = useState(false);
  const [error,                 setError]                 = useState('');
  const [fotoPreview,           setFotoPreview]           = useState(agente?.foto_perfil ? resolveAvatar(agente.foto_perfil) : null);
  const [subiendoFoto,          setSubiendoFoto]          = useState(false);
  const [loadingTemplate,       setLoadingTemplate]       = useState(false);
  const [posiblesCoordinadores, setPosiblesCoordinadores] = useState([]);
  const [permisosAbiertos,      setPermisosAbiertos]      = useState(true);
  const fotoInputRef = useRef(null);

  // Cargar lista de coordinadores posibles
  useEffect(() => {
    apiService.getAgentes().then(list => {
      if (Array.isArray(list)) {
        setPosiblesCoordinadores(list.filter(a => !agente || a.id !== agente.id));
      }
    }).catch(() => {});
  }, [agente]);

  // Permisos para la creación
  const form = usePermisosForm();

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  // Pre-carga la plantilla correspondiente al rol
  useEffect(() => {
    if (esEdicion) return;
    let cancelled = false;
    const cargarTemplate = async () => {
      setLoadingTemplate(true);
      try {
        const tpl = await apiService.getRolTemplate(formData.rol);
        if (!cancelled) form.load(tpl);
      } catch (_) {
        // Ignorar si no hay plantilla
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    };
    cargarTemplate();
    return () => { cancelled = true; };
  }, [formData.rol, esEdicion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setFotoPreview(preview);
    setSubiendoFoto(true);
    try {
      const result = await apiService.subirFotoPerfil(agente.id, file);
      window.dispatchEvent(new CustomEvent('agente:foto-actualizada', {
        detail: { id: agente.id, foto_perfil: result.foto_perfil + '?v=' + Date.now() },
      }));
    } catch (_) {
      setFotoPreview(agente?.foto_perfil ? resolveAvatar(agente.foto_perfil) : null);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validación: si tiene recuperación autónoma, requiere correo electrónico
    if (formData.puede_recuperar_auto && !formData.email?.trim()) {
      setError('Para habilitar la Recuperación Autónoma por Correo, es obligatorio ingresar el Correo Electrónico del usuario.');
      return;
    }

    setSubmitting(true);
    try {
      const coordIdLimpio = formData.puede_recuperar_auto
        ? null
        : (formData.coordinador_id ? Number(formData.coordinador_id) : null);

      const payload = esEdicion
        ? { ...formData, coordinador_id: coordIdLimpio }
        : { 
            ...formData, 
            coordinador_id: coordIdLimpio,
            password: formData.password || generarClaveTemporal(),
            permisos: form.serialize() 
          };
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || (esEdicion ? 'Error al guardar cambios' : 'Error al crear agente'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="agent-form" style={{ width: '100%', boxSizing: 'border-box' }}>
      {error && <div className="agent-form-error">{error}</div>}

      {/* Foto de perfil — solo en edición */}
      {esEdicion && (
        <div className="agent-photo-upload">
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFotoChange}
          />
          <div
            className={`agent-photo-circle${subiendoFoto ? ' uploading' : ''}`}
            onClick={() => !subiendoFoto && fotoInputRef.current?.click()}
          >
            {fotoPreview
              ? <img src={fotoPreview} alt="avatar" />
              : <User size={32} color="#8696a0" />
            }
            <div className="agent-photo-overlay">
              {subiendoFoto
                ? <span className="agent-photo-spinner" />
                : <Camera size={16} color="#fff" />
              }
            </div>
          </div>
          <span className="agent-photo-label">Foto de perfil</span>
        </div>
      )}

      {/* ── SECCIÓN 1: DATOS DE ACCESO Y CUENTA ───────────────────── */}
      <div className="agent-form-section-title">
        <User size={15} style={{ color: '#dc2626' }} />
        <span>Datos de Acceso y Cuenta</span>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>
            <span>Nombre de Usuario</span>
            <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input 
            type="text" 
            required 
            placeholder="ej. juanp, ventas1, soporte"
            value={formData.usuario} 
            onChange={e => set('usuario', e.target.value.toLowerCase().replace(/\s+/g, ''))} 
          />
        </div>

        <div className="form-group">
          <label>
            <span>Nombre Completo</span>
            <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input 
            type="text" 
            required 
            placeholder="Nombre y Apellidos"
            value={formData.nombre} 
            onChange={e => set('nombre', e.target.value)} 
          />
        </div>

        <div className="form-group">
          <label>
            <span>Correo Electrónico</span>
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>(opcional)</span>
          </label>
          <input 
            type="email" 
            placeholder="Opcional (solo personal directivo / gerencia)"
            value={formData.email} 
            onChange={e => set('email', e.target.value)} 
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>{esEdicion ? 'Nueva Contraseña' : 'Contraseña Temporal Inicial'}</span>
            {!esEdicion ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                ✨ Autogenerada por el sistema
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>• Vacío = no cambiar</span>
            )}
          </label>
          <div className="password-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              required={false}
              minLength={6}
              placeholder={esEdicion ? 'Mantener contraseña actual' : 'Automática (ej. Fibri_1234)'}
              value={formData.password}
              onChange={e => set('password', e.target.value)}
              style={!esEdicion ? { fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.5px' } : {}}
            />
            {!esEdicion && (
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => set('password', generarClaveTemporal())}
                tabIndex={-1}
                title="Generar otra contraseña aleatoria"
                style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: 700 }}
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {!esEdicion && (
            <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Al guardar, se mostrará en pantalla para que puedas copiarla y entregarla. Obligará cambio al primer login.
            </span>
          )}
        </div>
      </div>

      {/* ── SECCIÓN 2: PUESTO Y JERARQUÍA ────────────────────────── */}
      <div className="agent-form-section-title" style={{ marginTop: '22px' }}>
        <Briefcase size={15} style={{ color: '#dc2626' }} />
        <span>Puesto y Jerarquía Organizacional</span>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Rol en el Sistema</label>
          <select value={formData.rol} onChange={e => set('rol', e.target.value)}>
            <option value="colaborador">Colaborador (Chat Interno Corporativo)</option>
            <option value="asesor">Asesor (Atención Clientes WhatsApp + Chat)</option>
            <option value="ti">Soporte TI / Sistemas</option>
            <option value="admin">Administrador General (Super Usuario)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Área / Departamento</label>
          <select value={formData.area} onChange={e => set('area', e.target.value)}>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>Coordinador Responsable</span>
            {formData.puede_recuperar_auto ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>
                ✨ No requerido (Usuario independiente con recuperación autónoma)
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>
                (A quien acudirá si olvida su clave para recibir una temporal)
              </span>
            )}
          </label>
          <select 
            value={formData.puede_recuperar_auto ? '' : (formData.coordinador_id ?? '')} 
            onChange={e => set('coordinador_id', e.target.value ? Number(e.target.value) : '')}
            disabled={formData.puede_recuperar_auto}
            style={formData.puede_recuperar_auto ? { backgroundColor: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' } : {}}
          >
            {formData.puede_recuperar_auto ? (
              <option value="">No aplica — Usuario autónomo e independiente (recuperación directa por correo)</option>
            ) : (
              <>
                <option value="">Por defecto (Líder / Coordinador del Área correspondiente)</option>
                {posiblesCoordinadores.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {c.area} {c.es_coordinador ? '★ (Líder asignado)' : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Tarjeta Directivos / Recuperación Autónoma */}
        <label className={`agent-option-card${formData.puede_recuperar_auto ? ' active' : ''}`}>
          <input
            type="checkbox"
            checked={formData.puede_recuperar_auto}
            onChange={e => {
              const checked = e.target.checked;
              setFormData(prev => ({
                ...prev,
                puede_recuperar_auto: checked,
                coordinador_id: checked ? '' : prev.coordinador_id
              }));
            }}
          />
          <div className="agent-option-card-content">
            <strong>Recuperación de Contraseña Autónoma por Correo</strong>
            <p>
              Habilita que este usuario pueda restablecer su contraseña directamente por correo electrónico sin tener que acudir a un coordinador. Al marcar esta opción, el usuario no dependerá de ningún coordinador para recuperar su cuenta.
            </p>
          </div>
        </label>
      </div>

      {/* ── SECCIÓN 3: PERMISOS INICIALES (EN CREACIÓN) ───────────── */}
      {!esEdicion && (
        <div className="af-permisos-wrap" style={{ marginTop: '22px' }}>
          <div 
            className="af-permisos-header" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={() => setPermisosAbiertos(!permisosAbiertos)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} color="#dc2626" />
              <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>Permisos del Sistema</span>
              {loadingTemplate ? (
                <span className="af-tpl-loading">Cargando plantilla del rol…</span>
              ) : (
                <span className="af-tpl-hint">
                  (Pre-cargados según plantilla del rol • Clic para personalizar)
                </span>
              )}
            </div>
            {permisosAbiertos ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {permisosAbiertos && (
            <div style={{ marginTop: '12px' }}>
              <PermisosFormPanel form={form} />
            </div>
          )}
        </div>
      )}

      {/* ── STICKY FOOTER DE ACCIONES ──────────────────────────────── */}
      <div className="agent-form-actions">
        <button type="button" className="btn-cancel" onClick={onClose} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn-save" disabled={submitting || loadingTemplate}>
          {submitting
            ? (esEdicion ? 'Guardando...' : 'Creando...')
            : (esEdicion ? 'Guardar Cambios' : 'Crear Agente')
          }
        </button>
      </div>
    </form>
  );
};

export default AgentForm;
