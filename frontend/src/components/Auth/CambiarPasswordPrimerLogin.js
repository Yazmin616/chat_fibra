import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, LogOut, CheckCircle2, KeyRound } from 'lucide-react';
import { apiService } from '../../services/api';
import '../../styles/login.css';

const CambiarPasswordPrimerLogin = ({ user, onSuccess, onLogout }) => {
  const [nuevaPassword, setNuevaPassword]         = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [showPassword, setShowPassword]           = useState(false);
  const [showConfirm, setShowConfirm]             = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState('');
  const [success, setSuccess]                     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (nuevaPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden. Verifícalas e intenta de nuevo.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.cambiarPasswordObligatorio(nuevaPassword);
      if (res?.ok) {
        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess({
              ...user,
              debe_cambiar_password: false,
            });
          }
        }, 1400);
      } else {
        setError(res?.error || 'No se pudo actualizar la contraseña');
      }
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const longitudValida = nuevaPassword.length >= 6;
  const coinciden = Boolean(nuevaPassword && nuevaPassword === confirmarPassword);
  const tieneNumero = /\d/.test(nuevaPassword);
  const tieneMayus = /[A-Z]/.test(nuevaPassword);

  // Cálculo de fuerza de contraseña
  const calcularFuerza = () => {
    if (!nuevaPassword) return { nivel: 0, label: '', color: '#e5e7eb' };
    let score = 0;
    if (nuevaPassword.length >= 6) score++;
    if (nuevaPassword.length >= 8) score++;
    if (tieneNumero) score++;
    if (tieneMayus) score++;

    if (score <= 1) return { nivel: 1, label: 'Débil', color: '#ef4444' };
    if (score <= 2) return { nivel: 2, label: 'Aceptable', color: '#f59e0b' };
    if (score <= 3) return { nivel: 3, label: 'Buena', color: '#10b981' };
    return { nivel: 4, label: 'Muy Segura', color: '#059669' };
  };

  const fuerza = calcularFuerza();

  return (
    <div className="login-screen">
      <div className="login-geo-tr" />
      <div className="login-geo-bl" />

      <div className="login-card">
        <div className="login-slides">

          {/* ── Panel izquierdo — Fibri y Marca ── */}
          <div className="login-left">
            <div className="login-logos-top">
              <img src="/logo-fibratec.png"   alt="Fibratec"   />
              <div className="logos-separator" />
              <img src="/logo-compusemmm.png" alt="Compusemmm" />
            </div>

            <div className="login-left-body" style={{ flexDirection: 'column', textAlign: 'center' }}>
              <img src="/fibri.png" alt="Fibri" className="login-fibri" style={{ maxHeight: '240px', margin: '0 auto 12px' }} />
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '50px', background: '#fee2e2',
                color: '#dc2626', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.3px',
                textTransform: 'uppercase'
              }}>
                <ShieldCheck size={14} />
                <span>Seguridad de Acceso</span>
              </div>
            </div>

            <div className="login-left-footer">
              © 2026 Fibratec · Compusemmm de México<br />
              Todos los derechos reservados
            </div>
          </div>

          {/* ── Panel derecho — Formulario de cambio de contraseña ── */}
          <div className="login-right">
            <div className="login-form-container">
              
              {/* Encabezado */}
              <div className="login-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: '#fef2f2', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#dc2626'
                  }}>
                    <KeyRound size={18} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 700, color: '#111827' }}>
                    Crea tu Contraseña
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#6b7280', lineHeight: 1.45 }}>
                  Hola, <strong>{user?.nombre}</strong> ({user?.usuario ? `@${user.usuario}` : user?.email}). Por seguridad, debes definir una contraseña personal antes de ingresar al sistema.
                </p>
              </div>

              {/* Mensaje de Error */}
              {error && (
                <div className="login-error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Mensaje de Éxito */}
              {success && (
                <div style={{
                  background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                  padding: '12px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
                }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <span>¡Contraseña actualizada con éxito! Ingresando al CRM...</span>
                </div>
              )}

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="login-form">

                {/* Campo Nueva Contraseña */}
                <div className="input-group">
                  <div className="input-wrap">
                    <Lock className="input-icon" size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nueva contraseña personal"
                      value={nuevaPassword}
                      onChange={e => setNuevaPassword(e.target.value)}
                      disabled={loading || success}
                      required
                      autoFocus
                      style={{ paddingRight: '48px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: '16px', background: 'transparent',
                        border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center'
                      }}
                      title={showPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Barra indicadora de fuerza */}
                {nuevaPassword && (
                  <div style={{ margin: '-4px 4px 2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>Nivel de seguridad:</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: fuerza.color }}>{fuerza.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
                      {[1, 2, 3, 4].map(step => (
                        <div
                          key={step}
                          style={{
                            flex: 1,
                            borderRadius: '2px',
                            background: fuerza.nivel >= step ? fuerza.color : '#e5e7eb',
                            transition: 'background 0.2s'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Campo Confirmar Contraseña */}
                <div className="input-group">
                  <div className="input-wrap">
                    <Lock className="input-icon" size={17} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repite tu nueva contraseña"
                      value={confirmarPassword}
                      onChange={e => setConfirmarPassword(e.target.value)}
                      disabled={loading || success}
                      required
                      style={{ paddingRight: '48px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: '16px', background: 'transparent',
                        border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center'
                      }}
                      title={showConfirm ? 'Ocultar' : 'Mostrar'}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Requisitos mínimos */}
                <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: longitudValida ? '#16a34a' : '#9ca3af' }}>
                    <span style={{ fontSize: '12px' }}>{longitudValida ? '✓' : '○'}</span>
                    <span>Mínimo 6 caracteres</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: coinciden ? '#16a34a' : '#9ca3af' }}>
                    <span style={{ fontSize: '12px' }}>{coinciden ? '✓' : '○'}</span>
                    <span>Ambas contraseñas coinciden</span>
                  </div>
                </div>

                {/* Botón Principal */}
                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading || success || !longitudValida || !coinciden}
                  style={{ marginTop: '8px' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="spinner" size={17} /> Guardando...
                    </>
                  ) : (
                    'Guardar Contraseña y Continuar'
                  )}
                </button>

                {/* Botón Cerrar Sesión */}
                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loading}
                    style={{
                      background: 'transparent', border: 'none', color: '#9ca3af',
                      fontSize: '12px', cursor: 'pointer', display: 'inline-flex',
                      alignItems: 'center', gap: '5px', padding: '4px 8px',
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                    onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                  >
                    <LogOut size={13} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>

              </form>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CambiarPasswordPrimerLogin;
