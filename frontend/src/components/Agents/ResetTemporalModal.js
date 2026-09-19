import React, { useState } from 'react';
import { Key, X, Copy, Check, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { apiService } from '../../services/api';

const ResetTemporalModal = ({ agente, onClose, onPasswordReset }) => {
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [temporalPassword, setTemporalPassword] = useState(null);
  const [copiado,          setCopiado]          = useState(false);

  const handleGenerar = async () => {
    setLoading(true);
    setError('');
    setCopiado(false);
    try {
      const res = await apiService.resetPasswordTemporal(agente.id);
      if (res?.ok && res.temporalPassword) {
        setTemporalPassword(res.temporalPassword);
        if (onPasswordReset) {
          try { onPasswordReset(agente.id); } catch (_) {}
        }
      } else {
        setError(res?.error || 'No se pudo generar la contraseña temporal');
      }
    } catch (err) {
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleCopiar = () => {
    if (!temporalPassword) return;
    navigator.clipboard.writeText(temporalPassword);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: '16px', backdropFilter: 'blur(3px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#dc2626'
            }}>
              <Key size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                Contraseña Temporal
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {agente.nombre} {agente.usuario ? `(@${agente.usuario})` : ''}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px' }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
              backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              color: '#b91c1c', fontSize: '0.82rem', marginBottom: '16px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {!temporalPassword ? (
            <div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                <ShieldAlert size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                  ¿Deseas generar una contraseña temporal para <strong>{agente.nombre}</strong>?
                  <div style={{ marginTop: '6px', color: '#64748b', fontSize: '0.8rem' }}>
                    La contraseña anterior quedará invalidada de inmediato y el usuario <strong>deberá cambiarla obligatoriamente</strong> en cuanto inicie sesión.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerar}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px', backgroundColor: '#dc2626',
                  color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.88rem',
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px', transition: 'background 0.15s'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinner" /> Generando clave...
                  </>
                ) : (
                  <>
                    <Key size={16} /> Generar Contraseña Temporal
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '12px', padding: '18px', textAlign: 'center',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Contraseña Temporal Generada
                </span>
                
                <div style={{
                  fontSize: '1.6rem', fontWeight: 800, color: '#15803d',
                  letterSpacing: '2px', fontFamily: 'monospace', margin: '10px 0',
                  userSelect: 'all'
                }}>
                  {temporalPassword}
                </div>

                <button
                  type="button"
                  onClick={handleCopiar}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 18px', backgroundColor: copiado ? '#16a34a' : '#22c55e',
                    color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                  {copiado ? '¡Copiada!' : 'Copiar al portapapeles'}
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.4 }}>
                ℹ️ <strong>Instrucciones:</strong> Entrégale esta clave a <strong>{agente.nombre}</strong>. En cuanto ingrese su usuario <code>{agente.usuario || agente.email}</code> y esta clave, el sistema le pedirá crear su propia contraseña definitiva.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 22px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#334155',
              border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

export default ResetTemporalModal;
