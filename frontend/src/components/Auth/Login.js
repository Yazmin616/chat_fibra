import React, { useState } from 'react';
import { Lock, User, Loader2, Headphones, HelpCircle, X, Shield, Search, CheckCircle2, AlertCircle, Sparkles, Mail, Info, Send, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { apiService } from '../../services/api';

const Login = ({ onLoginSuccess }) => {
  const [usuario,   setUsuario]   = useState('');
  const [password,  setPassword]  = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Modal de ayuda "¿Olvidaste tu contraseña?"
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput,     setForgotInput]     = useState('');
  const [coordLoading,    setCoordLoading]    = useState(false);
  const [coordData,       setCoordData]       = useState(null);
  const [coordError,      setCoordError]      = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryError,   setRecoveryError]   = useState('');
  const [recoveryTempPassword, setRecoveryTempPassword] = useState('');
  const [copied,          setCopied]          = useState(false);

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
    setRecoverySuccess('');
    setRecoveryError('');
    setRecoveryTempPassword('');
    setCopied(false);
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

  const handleSolicitarRecuperacion = async () => {
    if (!coordData) return;
    const identifier = coordData.usuario || coordData.email || forgotInput.trim();
    setRecoveryLoading(true);
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryTempPassword('');
    setCopied(false);
    try {
      const data = await apiService.solicitarRecuperacionPassword(identifier);
      if (data?.ok) {
        setRecoverySuccess(data.mensaje || 'Contraseña temporal enviada a tu correo.');
        if (data.temporalPassword) {
          setRecoveryTempPassword(data.temporalPassword);
          setPassword(data.temporalPassword);
        }
      } else {
        setRecoveryError(data?.error || 'No se pudo generar la recuperación.');
      }
    } catch (err) {
      setRecoveryError(err?.message || 'Error al solicitar recuperación de contraseña.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleOpenForgot = (e) => {
    e.preventDefault();
    setForgotInput(usuario || '');
    setCoordData(null);
    setCoordError('');
    setRecoverySuccess('');
    setRecoveryError('');
    setRecoveryTempPassword('');
    setCopied(false);
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
                  <div className="input-wrap" style={{ position: 'relative' }}>
                    <Lock className="input-icon" size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Contraseña"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
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
                  <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.4, width: '100%' }}>
                    <strong>{coordData.nombre}</strong> (Área: {coordData.area})
                    {coordData.puede_recuperar_auto ? (
                      <div style={{ marginTop: '6px', color: '#15803d' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                          <Sparkles size={14} color="#15803d" />
                          <span>Cuenta Independiente:</span>
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          Tienes habilitada la recuperación autónoma por correo. No dependes de ningún coordinador para restablecer tu cuenta.
                        </div>
                        {coordData.email && (
                          <div style={{ marginTop: '6px', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={14} />
                            <span>Correo registrado: {coordData.email}</span>
                          </div>
                        )}
                        <div style={{ marginTop: '4px', fontStyle: 'italic', fontSize: '0.78rem' }}>
                          Puedes restablecer tu acceso directamente por correo o solicitar apoyo con el área de TI.
                        </div>

                        {coordData.email && (
                          <div style={{ marginTop: '12px' }}>
                            <button
                              type="button"
                              onClick={handleSolicitarRecuperacion}
                              disabled={recoveryLoading || !!recoverySuccess}
                              style={{
                                width: '100%',
                                padding: '9px 14px',
                                backgroundColor: recoverySuccess ? '#16a34a' : '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: recoverySuccess ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'background-color 0.2s'
                              }}
                            >
                              {recoveryLoading ? (
                                <><Loader2 size={15} className="spinner" /> Generando y enviando correo...</>
                              ) : recoverySuccess ? (
                                <><CheckCircle2 size={15} /> Clave enviada exitosamente</>
                              ) : (
                                <><Send size={15} /> Enviar contraseña temporal a mi correo</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px', color: '#14532d' }}>
                        Tu Coordinador asignado es: <strong>{coordData.coordinador_nombre}</strong>
                        {coordData.coordinador_email && ` (${coordData.coordinador_email})`}.

                        {coordData.email && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={handleSolicitarRecuperacion}
                              disabled={recoveryLoading || !!recoverySuccess}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                backgroundColor: recoverySuccess ? '#16a34a' : '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: recoverySuccess ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                            >
                              {recoveryLoading ? (
                                <><Loader2 size={14} className="spinner" /> Enviando...</>
                              ) : recoverySuccess ? (
                                <><CheckCircle2 size={14} /> Clave enviada</>
                              ) : (
                                <><Send size={14} /> Enviar clave temporal a mi correo</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {recoverySuccess && (
                <div style={{
                  backgroundColor: '#f0fdf4', border: '1px solid #86efac',
                  borderRadius: '10px', padding: '10px 12px', marginBottom: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '0.8rem'
                }}>
                  <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                  <span>{recoverySuccess}</span>
                </div>
              )}

              {recoveryTempPassword && (
                <div style={{
                  backgroundColor: '#ffffff', border: '1.5px dashed #16a34a',
                  borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                      Clave temporal de acceso generada:
                    </span>
                    <strong style={{ fontSize: '1.15rem', color: '#166534', letterSpacing: '1px', fontFamily: 'monospace' }}>
                      {recoveryTempPassword}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryTempPassword);
                      setPassword(recoveryTempPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: copied ? '#16a34a' : '#f8fafc',
                      color: copied ? '#ffffff' : '#1e293b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiada' : 'Copiar clave'}
                  </button>
                </div>
              )}

              {recoveryError && (
                <div style={{
                  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '10px', padding: '10px 12px', marginBottom: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.8rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{recoveryError}</span>
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
                padding: '10px 12px', borderRadius: '8px', lineHeight: 1.4,
                display: 'flex', alignItems: 'flex-start', gap: '8px'
              }}>
                <Info size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                  <strong>Nota:</strong> {coordData?.puede_recuperar_auto
                    ? 'Al recibir tu clave de recuperación, el sistema te solicitará establecer tu contraseña definitiva al iniciar sesión.'
                    : 'Cuando recibas o tu Coordinador te entregue la clave temporal, el sistema te solicitará automáticamente establecer tu contraseña definitiva al iniciar sesión.'}
                </span>
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
