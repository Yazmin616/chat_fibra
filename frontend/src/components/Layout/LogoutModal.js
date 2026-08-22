import React from 'react';
import { LogOut, X } from 'lucide-react';

const LogoutModal = ({ isOpen, user, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px'
          }}
          title="Cerrar"
        >
          <X size={18} />
        </button>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <LogOut size={26} strokeWidth={2.2} />
        </div>

        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 8px'
        }}>
          ¿Cerrar sesión?
        </h3>

        <p style={{
          fontSize: '0.9rem',
          color: '#64748b',
          lineHeight: 1.5,
          margin: '0 0 20px',
          maxWidth: '340px'
        }}>
          {user?.nombre ? (
            <>Estás conectado como <strong>{user.nombre}</strong>. ¿Deseas salir del sistema y desconectar tu sesión?</>
          ) : (
            <>¿Estás seguro de que deseas salir del sistema?</>
          )}
        </p>

        <div style={{
          display: 'flex',
          gap: '10px',
          width: '100%'
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
              transition: 'background 0.15s'
            }}
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
