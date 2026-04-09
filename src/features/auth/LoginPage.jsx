import React, { useState, useEffect } from 'react';
import './login.css';
import logoMetrica from '../../assets/logo_metrica.svg';
import soporteSvg from '../../assets/soporte_tecnico.svg';
import { safeStorage } from '../../shared/utils/storage';
import { useTheme } from '../../shared/context/ThemeContext';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${window.location.protocol}//${window.location.hostname}:3000/api`;
const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 60 * 1000;

export function LoginPage({ onLogin }) {
  const { isDarkGantt } = useTheme();
  const [usuario, setUsuario] = useState('');
  const [pass, setPass]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Estados para bloqueo
  const [attempts, setAttempts] = useState(() => {
    return parseInt(safeStorage.getItem('rimmet_login_attempts') || '0', 10);
  });
  const [lockUntil, setLockUntil] = useState(() => {
    const saved = safeStorage.getItem('rimmet_login_lock_until');
    return saved ? parseInt(saved, 10) : null;
  });
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Efecto para el temporizador de bloqueo
  useEffect(() => {
    if (!lockUntil) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= lockUntil) {
        // Desbloquear
        setLockUntil(null);
        setAttempts(0);
        setTimeRemaining(0);
        safeStorage.removeItem('rimmet_login_lock_until');
        safeStorage.setItem('rimmet_login_attempts', '0');
        clearInterval(interval);
      } else {
        setTimeRemaining(Math.ceil((lockUntil - now) / 1000));
      }
    }, 1000);

    // Ejecución inicial para no esperar 1 segundo
    const now = Date.now();
    if (now >= lockUntil) {
      setLockUntil(null);
      setAttempts(0);
      safeStorage.removeItem('rimmet_login_lock_until');
      safeStorage.setItem('rimmet_login_attempts', '0');
    } else {
      setTimeRemaining(Math.ceil((lockUntil - now) / 1000));
    }

    return () => clearInterval(interval);
  }, [lockUntil]);

  // Bloquear manualmente (llamado tras 3 fallos o si el backend manda 429)
  const lockAccount = (lockTimeMs = LOCK_TIME_MS) => {
    const until = Date.now() + lockTimeMs;
    setLockUntil(until);
    safeStorage.setItem('rimmet_login_lock_until', until.toString());
  };

  const handleFailedAttempt = () => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    safeStorage.setItem('rimmet_login_attempts', newAttempts.toString());
    if (newAttempts >= MAX_ATTEMPTS) {
      lockAccount();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, pass }),
      });
      const data = await res.json();
      
      // Controlar código 429 (bloqueo por backend)
      if (res.status === 429) {
        const remainingMs = (data.remainingSecs || 60) * 1000;
        lockAccount(remainingMs);
        setError(data.message || 'Cuenta bloqueada.');
        return;
      }

      if (!res.ok || !data.success) {
        handleFailedAttempt();
        const remAttempts = Math.max(0, MAX_ATTEMPTS - (attempts + 1));
        const remMsg = remAttempts > 0 ? ` (Intentos restantes: ${remAttempts})` : '';
        setError((data.message || 'Credenciales inválidas') + remMsg);
        return;
      }
      
      // Éxito: limpiar contadores
      const loggedUser = data.data.user;

      if (String(loggedUser.acceso_cron) === "0") {
        setError('Tu perfil no tiene permisos habilitados para acceder a esta aplicación.');
        return;
      }

      // Éxito: limpiar contadores
      setAttempts(0);
      setLockUntil(null);
      safeStorage.removeItem('rimmet_login_attempts');
      safeStorage.removeItem('rimmet_login_lock_until');
      
      // Pasar a calendar directamente
      safeStorage.setItem('rimmet_token', data.data.token);
      safeStorage.setItem('rimmet_user', JSON.stringify(loggedUser));
      safeStorage.setItem('rimmet_last_view', 'calendar');
      onLogin(loggedUser, 'calendar');
    } catch {
      setError('No se pudo conectar al servidor. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-root ${isDarkGantt ? '' : 'login-light'}`}>
      {/* Fondo SVG */}
      <div
        className="login-bg"
        style={{ backgroundImage: `url(${soporteSvg})` }}
      />
      {/* Overlay oscuro */}
      <div className="login-overlay" />

      {/* Contenido */}
      <div className="login-content">
        {/* Lado izquierdo — branding */}
        <div className="login-left">
          <img src={logoMetrica} alt="Metriga Logo" className="login-logo" />
          <div className="login-tagline">
            <h1 className="login-title">DataMET+</h1>
            <p className="login-subtitle">
              Cronograma Metrica y<br />Recepción de Registros de Instrumentos.
            </p>
          </div>
        </div>

        {/* Lado derecho — formulario */}
        <div className="login-right">
          <div className="login-card">
            {/* Header de la tarjeta */}
            <div className="login-card-header">
              <div className="login-card-dot" />
              <span className="login-card-label">
                Acceso a DataMET+
              </span>
            </div>

            <h2 className="login-card-title">
              {lockUntil ? 'Acceso Bloqueado' : 'Iniciar Sesión'}
            </h2>
            <p className="login-card-desc">
              {lockUntil 
                ? 'Por seguridad, hemos pausado los intentos de acceso.' 
                : 'Ingresa tus credenciales para continuar, son las mismas del DataMET'}
            </p>

            {
              lockUntil ? (
              <div className="login-locked-state">
                <div className="login-lock-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h3 className="login-lock-timer">{timeRemaining}s</h3>
                <p className="login-lock-msg">
                  Demasiados intentos fallidos.<br/>Intenta nuevamente cuando el contador termine.
                </p>
                <div className="login-progress-bg">
                  <div 
                    className="login-progress-bar" 
                    style={{ width: `${(timeRemaining / 60) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                {/* Usuario */}
                <div className="login-field">
                  <label htmlFor="login-usuario" className="login-label">Usuario</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                    <input
                      id="login-usuario"
                      type="text"
                      value={usuario}
                      onChange={e => setUsuario(e.target.value)}
                      placeholder="Ingresa tu usuario"
                      className="login-input"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="login-field">
                  <label htmlFor="login-pass" className="login-label">Contraseña</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input
                      id="login-pass"
                      type={showPass ? 'text' : 'password'}
                      value={pass}
                      onChange={e => setPass(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                      className="login-input"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-eye-btn"
                      onClick={() => setShowPass(v => !v)}
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPass ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="login-error" role="alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Botón */}
                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="login-spinner" />
                  ) : (
                    <>
                      <span>Ingresar</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="login-footer-text mt-8">
              © {new Date().getFullYear()} Metrica Ltda. — DataMET+
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
