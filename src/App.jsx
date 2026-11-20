import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { Sidebar } from './shared/components/layout/Sidebar';
import { Topbar } from './shared/components/layout/Topbar';
import { Footer } from './shared/components/layout/Footer';
import {
  APP_VIEWS, accesoPorPermiso, allowedView, canUseView, enPruebas, esperaPermisos, findSection, isSystemAdmin, managesCalibration, veControlCambios,
} from './shared/components/layout/navigation';
import { RestrictedArea } from './shared/components/layout/RestrictedArea';
import { useSidebar } from './shared/hooks/useSidebar';
import { useTheme } from './shared/context/ThemeContext';
import { safeStorage } from './shared/utils/storage';
import { decodeJwtPayload, isJwtExpired } from './shared/utils/jwt';
import { SESSION_INVALID_EVENT } from './shared/api/client';
import { leerRuta, navegar, rutaActual, rutaDe, useRuta } from './shared/navigation/ruta';
import { conTransicion } from './shared/utils/viewTransition';
import { useCalibrationAlertCount } from './features/calibration/hooks/useCalibrationAlertCount';
import { useSoporteAlertCount } from './features/soporte/hooks/useSoporteAlertCount';
import { useFailureSummary } from './features/system/hooks/useFailureSummary';
import { useMisPermisos } from './features/system/hooks/useMisPermisos';

// Cada apartado se descarga al abrirlo por primera vez. Tras iniciar sesión
// se precargan en segundo plano para que cambiar de apartado no espere.
const CARGAS = {
  RimPage: () => import('./features/rim/RimPage'),
  CalendarPage: () => import('./features/calendar/CalendarPage'),
  DeparturesPage: () => import('./features/departures/DeparturesPage'),
  CalibrationPage: () => import('./features/calibration/CalibrationPage'),
  SoportePage: () => import('./features/soporte/SoportePage'),
  ComercialPage: () => import('./features/comercial/ComercialPage'),
  IvmetManagementPage: () => import('./features/ivmet/IvmetManagementPage'),
  ChangeControlPage: () => import('./features/system/ChangeControlPage'),
  FailureLogPage: () => import('./features/system/FailureLogPage'),
  PermisosPage: () => import('./features/system/PermisosPage'),
  TiemposPage: () => import('./features/tiempos/TiemposPage'),
};
const perezoso = (nombre) => lazy(() => CARGAS[nombre]().then(module => ({ default: module[nombre] })));

const RimPage = perezoso('RimPage');
const CalendarPage = perezoso('CalendarPage');
const DeparturesPage = perezoso('DeparturesPage');
const CalibrationPage = perezoso('CalibrationPage');
const SoportePage = perezoso('SoportePage');
const ComercialPage = perezoso('ComercialPage');
const IvmetManagementPage = perezoso('IvmetManagementPage');
const ChangeControlPage = perezoso('ChangeControlPage');
const FailureLogPage = perezoso('FailureLogPage');
const PermisosPage = perezoso('PermisosPage');
const TiemposPage = perezoso('TiemposPage');
const LoginPage = lazy(() => import('./features/auth/LoginPage')
  .then(module => ({ default: module.LoginPage })));

const precargarApartados = () => {
  for (const cargar of Object.values(CARGAS)) cargar().catch(() => {});
};

function ViewFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-label="Cargando módulo">
      <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
    </div>
  );
}

function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      position="bottom-right"
      theme={resolvedTheme}
      toastOptions={{ className: 'rim-toast' }}
      icons={{
        success: <CheckCircle2 className="h-[18px] w-[18px] text-success" />,
        info: <Info className="h-[18px] w-[18px] text-info" />,
        warning: <AlertTriangle className="h-[18px] w-[18px] text-warning" />,
        error: <AlertCircle className="h-[18px] w-[18px] text-danger" />,
        loading: <Loader2 className="h-[18px] w-[18px] animate-spin text-fg-subtle" />,
      }}
    />
  );
}

function AppContent({ activeView, currentUser, handleLogout, renderView }) {
  const sidebar = useSidebar();
  const { isDesktop, close: closeSidebar } = sidebar;
  const calibrationAlerts = useCalibrationAlertCount(managesCalibration(currentUser));
  // Quien usa Soporte técnico ve el contador de próximos servicios.
  const soporteAlerts = useSoporteAlertCount(canUseView('soporte', currentUser));
  const failures = useFailureSummary(isSystemAdmin(currentUser));
  const pendingFailures = (failures?.abiertas || 0) + (failures?.enCurso || 0);
  // Sección abierta (/calibracion/equipos → Equipos): la barra superior la nombra.
  const ruta = leerRuta(useRuta());
  const section = ruta.vista === activeView ? findSection(activeView, ruta.resto[0], currentUser) : null;

  // Solo en producción: en desarrollo Vite compila cada módulo al pedirlo y
  // precargar todo de golpe retrasaría el apartado que se está abriendo.
  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    const precarga = window.requestIdleCallback
      ? window.requestIdleCallback(precargarApartados, { timeout: 4000 })
      : window.setTimeout(precargarApartados, 1500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(precarga) : window.clearTimeout(precarga));
  }, []);

  // Cada apartado tiene su dirección: el botón Atrás vuelve al anterior. Volver
  // a pulsar el apartado en el que se está no lo reinicia. Una sección de la
  // barra lateral abre esa pestaña (/soporte/proximos); dentro del mismo
  // apartado cambia solo el panel, como las pestañas de la página.
  const handleNavigate = useCallback((view, section) => {
    if (!isDesktop) closeSidebar();
    const destino = rutaDe(view, section);
    if (section ? destino === rutaActual() : view === activeView) return;
    safeStorage.setItem('datamet_last_view', view);
    navegar(destino, {
      transicion: view === activeView ? 'panel' : 'pagina',
      alCambiar: () => window.scrollTo({ top: 0 }),
    });
  }, [activeView, closeSidebar, isDesktop]);

  return (
    <>
      <AppToaster />
      <div className="flex min-h-dvh">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onLogout={handleLogout}
          badges={{
            ...(calibrationAlerts?.total ? {
              calibration: {
                count: calibrationAlerts.total,
                urgent: calibrationAlerts.vencidas > 0,
                label: `${calibrationAlerts.total} fechas de calibración requieren atención`,
              },
            } : {}),
            ...(soporteAlerts?.total ? {
              soporte: {
                count: soporteAlerts.total,
                urgent: soporteAlerts.vencidas > 0,
                label: `${soporteAlerts.total} próximos servicios de soporte requieren atención`,
              },
            } : {}),
            ...(pendingFailures > 0 ? {
              failures: {
                count: pendingFailures,
                urgent: failures.abiertas > 0,
                label: `${pendingFailures} fallas del sistema sin cerrar`,
              },
            } : {}),
          }}
          isOpen={sidebar.isOpen}
          isDesktop={isDesktop}
          onClose={closeSidebar}
        />
        <div className="blueprint flex min-w-0 flex-1 flex-col">
          <Topbar
            className="vt-barra"
            view={APP_VIEWS[activeView] || APP_VIEWS.rim}
            section={section}
            isSidebarOpen={sidebar.isOpen}
            isDesktop={isDesktop}
            onToggleSidebar={sidebar.toggle}
          />
          <div className="vt-pagina flex flex-1 flex-col">
            <div className="flex-1">
              <Suspense fallback={<ViewFallback />}>
                {renderView()}
              </Suspense>
            </div>
            <Footer />
          </div>
        </div>
      </div>
    </>
  );
}

function App() {
  const checkTokenValidity = () => {
    const payload = decodeJwtPayload(safeStorage.getItem('datamet_token'));
    // Sin payload legible no hay sesión; si lo hay, vale mientras no caduque.
    return Boolean(payload) && !isJwtExpired(payload);
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const isValid = checkTokenValidity();
    if (!isValid) {
      safeStorage.removeItem('datamet_token');
      safeStorage.removeItem('datamet_user');
    }
    return isValid;
  });
  const [usuarioGuardado, setCurrentUser] = useState(() => {
    const token = safeStorage.getItem('datamet_token');
    if (!token) return null;
    try {
      const saved = safeStorage.getItem('datamet_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Los permisos con nombre (Gestión de permisos) los da el backend; con
  // ellos el menú muestra, por ejemplo, los tiempos de servicio a los jefes de
  // todas las áreas. `permisos` es null mientras llegan.
  const misPermisos = useMisPermisos(isAuthenticated && usuarioGuardado ? usuarioGuardado.usuario || 'sesion' : null);
  const currentUser = useMemo(() => (usuarioGuardado
    ? {
      ...usuarioGuardado,
      permisos: misPermisos?.permisos ?? null,
      gestionaPermisos: misPermisos?.gestionar === true,
      enPruebas: misPermisos?.enPruebas ?? null,
    }
    : null), [misPermisos, usuarioGuardado]);

  // El apartado sale de la dirección (/cronograma, /soporte/…). En la raíz o
  // en una dirección desconocida vale el último que se usó. Si para decidir
  // faltan los permisos, se espera en el mismo apartado.
  const ruta = useRuta();
  const vistaRuta = leerRuta(ruta).vista;
  const vistaPedida = vistaRuta || safeStorage.getItem('datamet_last_view') || 'rim';
  const activeView = esperaPermisos(vistaPedida, currentUser) ? vistaPedida : allowedView(vistaPedida, currentUser);

  useEffect(() => {
    if (!isAuthenticated || vistaRuta === activeView) return;
    // Si la dirección ya cambió (por ejemplo, con Atrás), no se toca la nueva.
    if (rutaActual() !== ruta) return;
    navegar(rutaDe(activeView), { reemplazar: true });
  }, [activeView, isAuthenticated, ruta, vistaRuta]);

  useEffect(() => {
    if (isAuthenticated && vistaRuta === activeView) safeStorage.setItem('datamet_last_view', activeView);
  }, [activeView, isAuthenticated, vistaRuta]);
  // Por qué el servidor cerró la sesión; se muestra en el inicio de sesión.
  const [sessionNotice, setSessionNotice] = useState('');

  // Si se llegó con una dirección (un enlace o la sesión vencida a mitad de
  // trabajo), al entrar se vuelve a ella; si no, al apartado indicado.
  const handleLogin = (user, selectedView) => {
    conTransicion(() => {
      setSessionNotice('');
      setCurrentUser(user);
      if (selectedView && !leerRuta().vista) navegar(rutaDe(selectedView), { reemplazar: true });
      setIsAuthenticated(true);
    }, 'app');
  };

  const closeSession = useCallback(({ notice = '', keepRoute = false } = {}) => {
    conTransicion(() => {
      safeStorage.removeItem('datamet_token');
      safeStorage.removeItem('datamet_user');
      setSessionNotice(notice);
      setCurrentUser(null);
      setIsAuthenticated(false);
      if (!keepRoute) navegar('/', { reemplazar: true });
    }, 'app');
  }, []);

  const handleLogout = useCallback(() => closeSession(), [closeSession]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // La sesión vencida conserva la dirección: al volver a entrar se sigue ahí.
    const verifyToken = () => {
      if (!checkTokenValidity()) {
        closeSession({ notice: 'Tu sesión venció. Inicia sesión de nuevo para continuar.', keepRoute: true });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifyToken();
      }
    };

    // El servidor rechazó la sesión (token vencido, usuario desactivado o sin
    // acceso): de vuelta al inicio de sesión, con el motivo.
    const handleSessionInvalid = (event) => {
      closeSession({
        notice: event.detail?.message || 'Tu sesión ya no es válida. Inicia sesión de nuevo.',
        keepRoute: true,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    // Revisar la validez del token periódicamente
    const intervalId = setInterval(verifyToken, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
      clearInterval(intervalId);
    };
  }, [closeSession, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <>
        <AppToaster />
        <Suspense fallback={<ViewFallback />}>
          <LoginPage onLogin={handleLogin} notice={sessionNotice} />
        </Suspense>
      </>
    );
  }

  const renderView = () => {
    if (esperaPermisos(activeView, currentUser)) return <ViewFallback />;
    // Apartado de otra área: solo las secciones de sus permisos (los tiempos
    // de servicio para los jefes de todas las áreas) o, sin ellas, difuminado
    // y con el aviso.
    if (accesoPorPermiso(activeView, currentUser)) return <TiemposPage view={activeView} />;
    if (!canUseView(activeView, currentUser)) {
      return (
        <RestrictedArea
          view={APP_VIEWS[activeView]}
          enPruebas={enPruebas(activeView, currentUser)}
          onExit={() => {
            safeStorage.setItem('datamet_last_view', 'rim');
            navegar(rutaDe('rim'), { transicion: 'pagina' });
          }}
        />
      );
    }
    switch (activeView) {
      case 'ivmet':
        return <IvmetManagementPage onExit={() => navegar(rutaDe('calendar'), { transicion: 'pagina' })} />;
      case 'calendar':
        return <CalendarPage />;
      case 'calibration':
        return <CalibrationPage />;
      case 'soporte':
        return <SoportePage />;
      case 'comercial':
        return <ComercialPage currentUser={currentUser} />;
      case 'departures':
        return <DeparturesPage />;
      case 'changes':
        return veControlCambios(currentUser)
          ? <ChangeControlPage puedeRegistrar={isSystemAdmin(currentUser)} />
          : <RimPage currentUser={currentUser} />;
      case 'failures':
        return isSystemAdmin(currentUser) ? <FailureLogPage /> : <RimPage currentUser={currentUser} />;
      case 'permisos':
        return isSystemAdmin(currentUser) || currentUser?.gestionaPermisos
          ? <PermisosPage />
          : <RimPage currentUser={currentUser} />;
      case 'rim':
      default:
        return <RimPage currentUser={currentUser} />;
    }
  };

  return (
    <AppContent
      activeView={activeView}
      currentUser={currentUser}
      handleLogout={handleLogout}
      renderView={renderView}
    />
  );
}

export default App;
