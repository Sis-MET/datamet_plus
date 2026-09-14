import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { ivmetApi } from '../api/ivmet';
import { ivmetAccessSession } from '../accessSession';

export function IvmetAccessGate({ children, onExit }) {
  const session = useSyncExternalStore(
    ivmetAccessSession.subscribe,
    ivmetAccessSession.getSnapshot,
  );
  const [check, setCheck] = useState({
    loading: true,
    configured: false,
    error: '',
  });
  const [revision, setRevision] = useState(0);
  const [code, setCode] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [time, setTime] = useState(Date.now);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const input = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ivmetAccessSession.clear();
    };
  }, []);
  useEffect(() => {
    let ignore = false;
    ivmetApi
      .accessStatus()
      .then((data) => {
        if (!ignore)
          setCheck({ loading: false, configured: data.configured, error: '' });
      })
      .catch((failure) => {
        if (!ignore)
          setCheck({
            loading: false,
            configured: false,
            error: failure.message,
          });
      });
    return () => {
      ignore = true;
    };
  }, [revision]);
  useEffect(() => {
    if (!session.ticket) return;
    const verify = () => {
      if (
        session.expiresAt <= Date.now() ||
        session.auth !== ivmetAccessSession.readAuth()
      )
        ivmetAccessSession.clear();
    };
    const timer = window.setTimeout(
      verify,
      Math.max(0, session.expiresAt - Date.now()),
    );
    window.addEventListener('focus', verify);
    document.addEventListener('visibilitychange', verify);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, [session]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      setTime(Date.now());
      if (retryAt <= Date.now()) setRetryAt(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || !code || retryAt > Date.now()) return;
    submitting.current = true;
    const authAtRequest = ivmetAccessSession.readAuth();
    setBusy(true);
    setError('');
    setVisible(false);
    try {
      const result = await ivmetApi.unlock(code);
      if (mounted.current && !ivmetAccessSession.accept(result, authAtRequest))
        setError('Tu sesión cambió. Inicia sesión nuevamente.');
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message);
        if (failure.data?.retryAfter) {
          const until = Date.now() + failure.data.retryAfter * 1000;
          setRetryAt(until);
          setTime(Date.now());
        }
        input.current?.focus();
      }
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setCode('');
        setBusy(false);
      }
    }
  };
  const remaining = Math.max(0, Math.ceil((retryAt - time) / 1000));
  if (session.ticket) return children(ivmetAccessSession.clear);

  return (
    <main className="iv-app iv-access-shell">
      <section
        className="iv-access-card iv-content-enter"
        aria-labelledby="iv-access-title"
      >
        <div className="iv-access-heading">
          <div className="iv-access-icon">
            <LockKeyhole size={25} aria-hidden="true" />
          </div>
          <span className="iv-development-badge">
            <Code2 size={13} aria-hidden="true" /> En desarrollo
          </span>
        </div>
        <span className="iv-eyebrow">CENTRO DE GESTIÓN · MÉTRICA</span>
        <h1 id="iv-access-title">Gestión IvMET</h1>
        <p className="iv-access-description">
          Este módulo se encuentra en desarrollo y todavía no está disponible
          para uso general.
        </p>
        <div className="iv-access-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            El acceso de pruebas está reservado al personal autorizado. Tus
            otros módulos siguen disponibles.
          </p>
        </div>
        {check.loading ? (
          <p className="iv-access-loading" role="status">
            <Loader2 size={17} className="animate-spin" /> Comprobando acceso…
          </p>
        ) : check.configured ? (
          <form onSubmit={submit} className="iv-access-form">
            <label htmlFor="iv-access-code">Código de acceso</label>
            <div className="iv-access-input">
              <KeyRound size={17} aria-hidden="true" />
              <input
                ref={input}
                id="iv-access-code"
                name="ivmet-development-code"
                type={visible ? 'text' : 'password'}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError('');
                }}
                placeholder="Introduce tu código"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={72}
                required
                readOnly={busy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'iv-access-error' : 'iv-access-help'}
              />
              <button
                type="button"
                className="iv-icon-button"
                aria-label={visible ? 'Ocultar código' : 'Mostrar código'}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
                disabled={busy}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <p id="iv-access-help" className="iv-access-help">
              Respeta mayúsculas y símbolos; no agregues comillas ni barras de escape.
              Se solicitará de nuevo al salir del módulo o recargar la página.
            </p>
            {error && (
              <p className="iv-access-error" role="alert" id="iv-access-error">
                {error}
              </p>
            )}
            <button
              className="iv-button primary iv-access-submit"
              disabled={busy || !code || remaining > 0}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Validando…
                </>
              ) : remaining ? (
                `Reintenta en ${remaining} s`
              ) : (
                <>
                  Entrar al gestor <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="iv-access-unavailable" role="status">
            <p>
              {check.error ||
                'El acceso de pruebas todavía no está configurado en este servidor.'}
            </p>
            <button
              className="iv-button secondary small"
              onClick={() => {
                setCheck({ loading: true, configured: false, error: '' });
                setRevision((value) => value + 1);
              }}
            >
              Comprobar de nuevo
            </button>
          </div>
        )}
        {onExit && (
          <button className="iv-access-back" onClick={onExit}>
            <ArrowLeft size={15} /> Volver al Cronograma
          </button>
        )}
      </section>
    </main>
  );
}
