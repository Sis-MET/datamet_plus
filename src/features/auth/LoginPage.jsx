import React, { useState, useEffect } from 'react';
import './login.css';
import logoMetrica from '../../assets/logo_metrica.svg';
import soporteSvg from '../../assets/soporte_tecnico.svg';
import { ClipboardList, CalendarDays, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';
const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 60 * 1000;

export function LoginPage({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [pass, setPass]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [step, setStep]         = useState(1);
  const [authData, setAuthData] = useState(null);

  // Estados para bloqueo
  const [attempts, setAttempts] = useState(() => {
    return parseInt(localStorage.getItem('rimmet_login_attempts') || '0', 10);
  });
  const [lockUntil, setLockUntil] = useState(() => {
    const saved = localStorage.getItem('rimmet_login_lock_until');
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
        localStorage.removeItem('rimmet_login_lock_until');
        localStorage.setItem('rimmet_login_attempts', '0');
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
      localStorage.removeItem('rimmet_login_lock_until');
      localStorage.setItem('rimmet_login_attempts', '0');
    } else {
      setTimeRemaining(Math.ceil((lockUntil - now) / 1000));
    }

    return () => clearInterval(interval);
  }, [lockUntil]);

  // Bloquear manualmente (llamado tras 3 fallos o si el backend manda 429)
  const lockAccount = (lockTimeMs = LOCK_TIME_MS) => {
    const until = Date.now() + lockTimeMs;
    setLockUntil(until);
    localStorage.setItem('rimmet_login_lock_until', until.toString());
  };

  const handleFailedAttempt = () => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    localStorage.setItem('rimmet_login_attempts', newAttempts.toString());
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
      setAttempts(0);
      setLockUntil(null);
      localStorage.removeItem('rimmet_login_attempts');
      localStorage.removeItem('rimmet_login_lock_until');
      
      // Pasar a step 2
      setAuthData(data.data);
      setStep(2);
    } catch {
      setError('No se pudo conectar al servidor. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModule = (moduleName) => {
    if (!authData) return;
    localStorage.setItem('rimmet_token', authData.token);
    localStorage.setItem('rimmet_user', JSON.stringify(authData.user));
    localStorage.setItem('rimmet_last_view', moduleName);
    onLogin(authData.user, moduleName);
  };

  return (
    <div className="login-root">
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
            <h1 className="login-title">NextMET</h1>
            <p className="login-subtitle">
              Calendario Metrica y<br />Recepción de Registros de Instrumentos.
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
                {step === 1 ? 'Acceso a NextMET' : 'Selección de Módulo'}
              </span>
            </div>

            <h2 className="login-card-title">
              {step === 1 
                ? (lockUntil ? 'Acceso Bloqueado' : 'Iniciar Sesión')
                : `¡Hola, ${authData?.user?.usuario?.split(' ')[0] || 'Usuario'}!`
              }
            </h2>
            <p className="login-card-desc">
              {step === 1
                ? (lockUntil ? 'Por seguridad, hemos pausado los intentos de acceso.' : 'Ingresa tus credenciales para continuar, son las mismas del DataMET')
                : '¿A qué apartado deseas ingresar hoy?'
              }
            </p>

            {step === 1 ? (
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
              )
            ) : (
               <div className="flex flex-col gap-3 mt-6">
                {/* RIM Card */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('rim')}
                  className="group relative flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary-500/50 hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden text-left shadow-lg hover:shadow-primary-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  
                  <div className="flex items-center gap-4 relative z-10 w-full">
                    <div className="p-3 bg-primary-500/20 rounded-xl text-primary-400 group-hover:scale-110 group-hover:bg-primary-500 group-hover:text-white transition-all duration-300 shrink-0">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white mb-0.5 group-hover:text-primary-300 transition-colors">Formulario RIM</h3>
                      <p className="text-[11px] text-gray-400 leading-snug pr-2">Recepción de Registros de Instrumentos Métrica.</p>
                    </div>
                    <div className="p-1.5 rounded-full bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-primary-500 group-hover:translate-x-1 transition-all duration-300 shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {/* Calendar Card */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('calendar')}
                  className="group relative flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-green-500/50 hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden text-left shadow-lg hover:shadow-green-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  
                  <div className="flex items-center gap-4 relative z-10 w-full">
                     <div className="p-3 bg-green-500/20 rounded-xl text-green-400 group-hover:scale-110 group-hover:bg-green-500 group-hover:text-white transition-all duration-300 shrink-0">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white mb-0.5 group-hover:text-green-300 transition-colors">Calendario Métrica</h3>
                      <p className="text-[11px] text-gray-400 leading-snug pr-2">Planificación y seguimiento de actividades.</p>
                    </div>
                    <div className="p-1.5 rounded-full bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-green-500 group-hover:translate-x-1 transition-all duration-300 shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>
               </div>
            )}

            <p className="login-footer-text mt-8">
              © {new Date().getFullYear()} Metrica Ltda. — NextMET
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
