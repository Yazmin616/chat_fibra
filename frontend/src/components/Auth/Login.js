import React, { useState } from 'react';
import { Lock, User, Loader2, Headphones, HelpCircle, X, Shield, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';

const Login = ({ onLoginSuccess }) => {
  const [usuario,   setUsuario]   = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Modal de ayuda "¿Olvidaste tu contraseña?"
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput,     setForgotInput]     = useState('');
  const [coordLoading,    setCoordLoading]    = useState(false);
  const [coordData,       setCoordData]       = useState(null);
  const [coordError,      setCoordError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiService.login(usuario.trim(), password);
      if (data?.token) {
        onLoginSuccess(data);
      } else {
        setError(data?.error || 'Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setError(err?.message || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarCoordinador = async (e) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    setCoordLoading(true);
    setCoordError('');
    setCoordData(null);
    try {
      const data = await apiService.consultarCoordinador(forgotInput.trim());
      if (data?.encontrado) {
        setCoordData(data);
      } else {
        setCoordError(data?.mensaje || 'No se encontró un usuario con ese identificador. Contacta a TI.');
      }
    } catch {
      setCoordError('Error al consultar. Por favor acércate a tu supervisor o a TI.');
    } finally {
      setCoordLoading(false);
    }
  };

  const handleOpenForgot = (e) => {
    e.preventDefault();
    setForgotInput(usuario || '');
    setCoordData(null);
    setCoordError('');
    setShowForgotModal(true);
  };

  return (
    <div className="login-screen">
      <div className="login-geo-tr" />
      <div className="login-geo-bl" />

      <div className="login-card">
        <div className="login-slides">

          {/* ── Panel izquierdo — Fibri (solo desktop/tablet) ── */}
          <div className="login-left">
            <div className="login-logos-top">
              <img src="/logo-fibratec.png"   alt="Fibratec"   />
              <div className="logos-separator" />
              <img src="/logo-compusemmm.png" alt="Compusemmm" />
            </div>
            <div className="login-left-body">
              <img src="/fibri.png" alt="Fibri" className="login-fibri" />
            </div>
            <div className="login-left-footer">
              © 2026 Fibratec · Compusemmm de México<br />
              Todos los derechos reservados
            </div>
          </div>

          {/* ── Panel derecho — Formulario ── */}
          <div className="login-right">
            <div className="login-form-container">

              {/* Logos visibles solo en móvil */}
              <div className="login-mobile-logos">
                <img src="/logo-fibratec.png"   alt="Fibratec"   />
                <div className="logos-separator" />
                <img src="/logo-compusemmm.png" alt="Compusemmm" />
              </div>

              <div className="login-header">
                <h2>Iniciar sesión</h2>
                <p>Ingresa tu usuario y contraseña para continuar</p>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                {error && <div className="login-error">{error}</div>}

                <div className="input-group">
                  <div className="input-wrap">
                    <User className="input-icon" size={17} />
                    <input
                      type="text"
                      placeholder="Usuario"
                      value={usuario}
                      onChange={e => setUsuario(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <div className="input-wrap">
                    <Lock className="input-icon" size={17} />
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="login-options">
                  <button 
                    type="button" 
                    onClick={handleOpenForgot}
                    className="login-forgot"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading
                    ? <><Loader2 className="spinner" size={18} /> Verificando...</>
                    : <><Headphones size={18} /> Ingresar</>
                  }
                </button>
              </form>

              <div className="login-right-footer">
                ¿Problemas para acceder? Contacta a tu Coordinador o TI<br />
                <a href="mailto:desarrollo@fibratec.mx">desarrollo@fibratec.mx</a>
                {' · '}
                <a href="https://wa.me/527121533681" target="_blank" rel="noreferrer">WhatsApp TI</a>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ── Modal informativo: Olvido de contraseña / Jerarquía Coordinadores ── */}
      {showForgotModal && (
        <div 
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: '16px', backdropFilter: 'blur(3px)'
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#dc2626'
                }}>
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    Recuperación de Contraseña
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Protocolo de seguridad institucional
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowForgotModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido */}
            <div style={{ padding: '22px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                Por políticas de seguridad de la empresa, el personal debe acudir directamente con su <strong>Coordinador de Área</strong> o con el <strong>Administrador</strong> para que le genere una <strong>contraseña temporal</strong>.
              </p>

              {/* Buscador de Coordinador */}
              <div style={{ 
                backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', 
                borderRadius: '12px', padding: '14px', marginBottom: '14px' 
              }}>
                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  ¿No sabes quién es tu Coordinador? Consúltalo aquí:
                </span>
                <form onSubmit={handleBuscarCoordinador} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Ingresa tu usuario"
                    value={forgotInput}
                    onChange={e => setForgotInput(e.target.value)}
                    style={{
                      flex: 1, padding: '8px 12px', fontSize: '0.82rem',
                      border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={coordLoading || !forgotInput.trim()}
                    style={{
                      padding: '8px 14px', backgroundColor: '#dc2626', color: '#fff',
                      border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    {coordLoading ? <Loader2 size={14} className="spinner" /> : <Search size={14} />}
                    Buscar
                  </button>
                </form>
              </div>

              {/* Resultado de la búsqueda */}
              {coordData && (
                <div style={{
                  backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px'
                }}>
                  <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.4 }}>
                    <strong>{coordData.nombre}</strong> (Área: {coordData.area})
                    {coordData.puede_recuperar_auto ? (
                      <div style={{ marginTop: '6px', color: '#15803d' }}>
                        ✨ <strong>Cuenta Independiente:</strong> Tienes habilitada la recuperación autónoma por correo. No dependes de ningún coordinador para restablecer tu cuenta.
                        {coordData.email && (
                          <div style={{ marginTop: '4px', color: '#166534', fontWeight: 600 }}>
                            📧 Correo registrado: {coordData.email}
                          </div>
                        )}
                        <div style={{ marginTop: '4px', fontStyle: 'italic', fontSize: '0.78rem' }}>
                          Puedes restablecer tu acceso directamente por correo o solicitar apoyo con el área de TI.
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px', color: '#14532d' }}>
                        Tu Coordinador asignado es: <strong>{coordData.coordinador_nombre}</strong>
                        {coordData.coordinador_email && ` (${coordData.coordinador_email})`}.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {coordError && (
                <div style={{
                  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '10px', padding: '10px 12px', marginBottom: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.8rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{coordError}</span>
                </div>
              )}

              <div style={{
                fontSize: '0.78rem', color: '#64748b', backgroundColor: '#f1f5f9',
                padding: '10px 12px', borderRadius: '8px', lineHeight: 1.4
              }}>
                ℹ️ <strong>Nota:</strong> {coordData?.puede_recuperar_auto
                  ? 'Al recibir tu clave de recuperación, el sistema te solicitará establecer tu contraseña definitiva al iniciar sesión.'
                  : 'Cuando tu Coordinador te entregue la clave temporal, el sistema te solicitará automáticamente establecer tu contraseña definitiva al iniciar sesión.'}
              </div>
            </div>

            {/* Footer modal */}
            <div style={{
              padding: '12px 22px', borderTop: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#334155',
                  border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Entendido, cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Login;
