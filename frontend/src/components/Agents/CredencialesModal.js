import React, { useState } from 'react';
import { KeyRound, X, Copy, Check, ShieldCheck, User, Sparkles, MessageSquare } from 'lucide-react';

const CredencialesModal = ({ agente, onClose }) => {
  const [copiadoPassword, setCopiadoPassword] = useState(false);
  const [copiadoTodo, setCopiadoTodo] = useState(false);

  if (!agente) return null;

  const usuario = agente.usuario || '';
  const password = agente.temporal_password || agente.password || '';
  const nombre = agente.nombre || 'Colaborador';

  const handleCopiarPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiadoPassword(true);
    setTimeout(() => setCopiadoPassword(false), 2500);
  };

  const handleCopiarTodo = () => {
    const texto = `¡Hola, ${nombre}!\n\nTe comparto tus accesos al sistema CRM de Fibratec:\n\nUsuario: ${usuario}\nContraseña temporal: ${password}\n\nNota: Al iniciar sesión por primera vez, el sistema te solicitará cambiar esta contraseña por una propia y definitiva.`;
    navigator.clipboard.writeText(texto);
    setCopiadoTodo(true);
    setTimeout(() => setCopiadoTodo(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente suave */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.15)',
              }}
            >
              <KeyRound size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                ¡Usuario Creado Exitosamente!
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Credenciales de acceso temporal generadas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Tarjeta de información del agente */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Colaborador
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {nombre}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Usuario
              </div>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#dc2626',
                  fontFamily: 'monospace',
                  backgroundColor: '#fee2e2',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  marginTop: '2px',
                  display: 'inline-block',
                }}
              >
                @{usuario}
              </div>
            </div>
          </div>

          {/* Caja Destacada de Contraseña Temporal */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#fffbeb',
              borderRadius: '12px',
              border: '1.5px dashed #f59e0b',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🔑 Contraseña Temporal Inicial
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#d97706',
                  backgroundColor: '#fef3c7',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                1er Login Obligatorio
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #fde68a',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#b45309',
                  letterSpacing: '1px',
                }}
              >
                {password}
              </span>

              <button
                type="button"
                onClick={handleCopiarPassword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: copiadoPassword ? '#16a34a' : '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {copiadoPassword ? (
                  <>
                    <Check size={16} /> ¡Copiada!
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copiar Clave
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Botón copiar formato completo (para WhatsApp / Chat) */}
          <button
            type="button"
            onClick={handleCopiarTodo}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          >
            {copiadoTodo ? (
              <>
                <Check size={16} color="#16a34a" />
                <span style={{ color: '#16a34a' }}>¡Mensaje de credenciales copiado al portapapeles!</span>
              </>
            ) : (
              <>
                <MessageSquare size={16} color="#475569" />
                <span>Copiar formato para compartir por WhatsApp / Chat</span>
              </>
            )}
          </button>

          {/* Alerta informativa de cambio de contraseña */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: '10px',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '0.8rem',
              lineHeight: 1.45,
            }}
          >
            <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#2563eb' }} />
            <span>
              Proporciona esta contraseña al colaborador. El sistema detectará su cuenta nueva y le solicitará de forma obligatoria cambiarla por una contraseña personal en su primer inicio de sesión.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 22px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            Entendido y Finalizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredencialesModal;
