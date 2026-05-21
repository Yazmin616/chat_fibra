import React, { useState } from 'react';
import { Lock, Mail, Loader2, Headphones } from 'lucide-react';
import { apiService } from '../../services/api';

const Login = ({ onLoginSuccess }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiService.login(email, password);
      if (data?.token) {
        onLoginSuccess(data);
      } else {
        setError(data?.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
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
                <p>Ingresa tus credenciales para continuar</p>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                {error && <div className="login-error">{error}</div>}

                <div className="input-group">
                  <div className="input-wrap">
                    <Mail className="input-icon" size={17} />
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
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
                    />
                  </div>
                </div>

                <div className="login-options">
                  <a href="#" className="login-forgot">¿Olvidaste tu contraseña? <span style={{fontSize:'10px', color:'#f97316'}}>(en desarrollo)</span></a>
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading
                    ? <><Loader2 className="spinner" size={18} /> Verificando...</>
                    : <><Headphones size={18} /> Ingresar</>
                  }
                </button>
              </form>

              <div className="login-right-footer">
                ¿Problemas para acceder? Contacta al área de Desarrollo<br />
                <a href="mailto:desarrollo@fibratec.mx">desarrollo@fibratec.mx</a>
                {' · '}
                <a href="https://wa.me/527121533681" target="_blank" rel="noreferrer">WhatsApp</a>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
