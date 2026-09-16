import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import logoMetrica from '../../assets/logo_metrica.svg';
import { safeStorage } from '../../shared/utils/storage';
import { api, ApiError } from '../../shared/api/client';
import { ThemeToggle } from '../../shared/components/layout/ThemeToggle';
const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 60 * 1000;

function FieldIcon({ icon }) {
  const Icon = icon;
  return (
    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-fg-subtle transition-colors group-focus-within:text-fg">
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

export function LoginPage({ onLogin }) {
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
      const data = await api.post('/auth/login', { usuario, pass });

      if (!data.success) {
        handleFailedAttempt();
        const remAttempts = Math.max(0, MAX_ATTEMPTS - (attempts + 1));
        const remMsg = remAttempts > 0 ? ` (Intentos restantes: ${remAttempts})` : '';
        setError((data.message || 'Credenciales inválidas') + remMsg);
        return;
      }

      const loggedUser = data.data.user;

      if (String(loggedUser.acceso_cron) === "0") {
        setError('Tu perfil no tiene permisos habilitados para acceder a esta aplicación.');
        return;
      }

      setAttempts(0);
      setLockUntil(null);
      safeStorage.removeItem('rimmet_login_attempts');
      safeStorage.removeItem('rimmet_login_lock_until');

      safeStorage.setItem('rimmet_token', data.data.token);
      safeStorage.setItem('rimmet_user', JSON.stringify(loggedUser));
      safeStorage.setItem('rimmet_last_view', 'calendar');
      onLogin(loggedUser, 'calendar');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const remainingMs = (err.data?.remainingSecs || 60) * 1000;
        lockAccount(remainingMs);
        setError(err.data?.message || 'Cuenta bloqueada.');
      } else {
        setError('No se pudo conectar al servidor. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const lockProgress = Math.max(0, Math.min(100, (timeRemaining / 60) * 100));

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas text-fg lg:flex-row">
      <ThemeToggle className="absolute right-3 top-3 z-10 sm:right-5 sm:top-5" />

      {/* Marca */}
      <section className="flex flex-col justify-between gap-10 border-b border-line bg-surface px-6 pb-8 pt-6 sm:px-10 sm:pt-10 lg:w-[44%] lg:max-w-[640px] lg:border-b-0 lg:border-r lg:px-14 lg:py-14">
        <img
          src={logoMetrica}
          alt="Métrica Ltda. — Expertos en sistemas de pesaje"
          className="h-11 w-auto self-start select-none sm:h-14"
          draggable={false}
        />

        <div className="max-w-md">
          <h1 className="flex items-center gap-2 text-4xl font-semibold tracking-[-0.03em] text-fg sm:text-5xl">
            DataMET
            <span className="sr-only">+</span>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-3xl font-bold leading-none text-brand-fg sm:h-11 sm:w-11 sm:text-4xl"
              aria-hidden="true"
            >
              +
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-fg-muted sm:text-lg">
            Cronograma Metrica y Recepción de Registros de Instrumentos.
          </p>
        </div>

        <p className="hidden text-sm text-fg-subtle lg:block">
          © {new Date().getFullYear()} Metrica Ltda. — DataMET+
        </p>
      </section>

      {/* Acceso */}
      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[380px] animate-fade-in-up">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
            {lockUntil ? 'Acceso bloqueado' : 'Iniciar sesión'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            {lockUntil
              ? 'Por seguridad, hemos pausado los intentos de acceso.'
              : 'Ingresa tus credenciales para continuar, son las mismas del DataMET.'}
          </p>

          {lockUntil ? (
            <div className="mt-8 rounded-2xl border border-line bg-surface p-6 text-center shadow-card" role="status">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <LockKeyhole className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <p className="mt-4 text-4xl font-semibold tabular-nums tracking-[-0.02em] text-fg">
                {timeRemaining}s
              </p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                Demasiados intentos fallidos. Intenta nuevamente cuando el contador termine.
              </p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-fg/[0.08]">
                <div
                  className="h-full rounded-full bg-fg transition-[width] duration-1000 ease-linear"
                  style={{ width: `${lockProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
              <div>
                <label htmlFor="login-usuario" className="field-label">Usuario</label>
                <div className="group relative">
                  <FieldIcon icon={UserRound} />
                  <input
                    id="login-usuario"
                    type="text"
                    value={usuario}
                    onChange={e => setUsuario(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    className="field h-11 pl-11"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-pass" className="field-label">Contraseña</label>
                <div className="group relative">
                  <FieldIcon icon={LockKeyhole} />
                  <input
                    id="login-pass"
                    type={showPass ? 'text' : 'password'}
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className="field h-11 pl-11 pr-12"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-1.5 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-fg/[0.06] hover:text-fg"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass
                      ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.9} />
                      : <Eye className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-3 text-sm font-medium text-danger animate-fade-in"
                  role="alert"
                >
                  <AlertCircle className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-[background-color,transform] duration-150 hover:bg-brand-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-label="Validando credenciales" />
                ) : (
                  <>
                    <span>Ingresar</span>
                    <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-10 text-center text-xs text-fg-subtle lg:hidden">
            © {new Date().getFullYear()} Metrica Ltda. — DataMET+
          </p>
        </div>
      </main>
    </div>
  );
}
