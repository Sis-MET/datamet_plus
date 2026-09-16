import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { Sidebar } from './shared/components/layout/Sidebar';
import { Topbar } from './shared/components/layout/Topbar';
import { Footer } from './shared/components/layout/Footer';
import { APP_VIEWS, canManageIvmet } from './shared/components/layout/navigation';
import { useSidebar } from './shared/hooks/useSidebar';
import { useTheme } from './shared/context/ThemeContext';
import { safeStorage } from './shared/utils/storage';

const RimFormPage = lazy(() => import('./features/rim/RimFormPage')
  .then(module => ({ default: module.RimFormPage })));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage')
  .then(module => ({ default: module.CalendarPage })));
const DeparturesPage = lazy(() => import('./features/departures/DeparturesPage')
  .then(module => ({ default: module.DeparturesPage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage')
  .then(module => ({ default: module.LoginPage })));
const IvmetManagementPage = lazy(() => import('./features/ivmet/IvmetManagementPage')
  .then(module => ({ default: module.IvmetManagementPage })));

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

function AppContent({ activeView, setActiveView, currentUser, handleLogout, renderView }) {
  const sidebar = useSidebar();
  const { isDesktop, close: closeSidebar } = sidebar;

  const handleNavigate = useCallback((view) => {
    safeStorage.setItem('rimmet_last_view', view);
    setActiveView(view);
    if (!isDesktop) closeSidebar();
    window.scrollTo({ top: 0 });
  }, [closeSidebar, isDesktop, setActiveView]);

  return (
    <>
      <AppToaster />
      <div className="flex min-h-dvh">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onLogout={handleLogout}
          isOpen={sidebar.isOpen}
          isDesktop={isDesktop}
          onClose={closeSidebar}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            view={APP_VIEWS[activeView] || APP_VIEWS.rim}
            isSidebarOpen={sidebar.isOpen}
            isDesktop={isDesktop}
            onToggleSidebar={sidebar.toggle}
          />
          <div className="flex-1">
            <Suspense fallback={<ViewFallback />}>
              {renderView()}
            </Suspense>
          </div>
          <Footer />
        </div>
      </div>
    </>
  );
}

function App() {
  const checkTokenValidity = () => {
    const token = safeStorage.getItem('rimmet_token');
    if (!token) return false;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/, '/');
      const payload = JSON.parse(window.atob(base64));
      // Verificar si existe la fecha de expiración y ya fue superada (en segundos)
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const isValid = checkTokenValidity();
    if (!isValid) {
      safeStorage.removeItem('rimmet_token');
      safeStorage.removeItem('rimmet_user');
    }
    return isValid;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const token = safeStorage.getItem('rimmet_token');
    if (!token) return null;
    try {
      const saved = safeStorage.getItem('rimmet_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeView, setActiveView] = useState(() => {
    const savedView = safeStorage.getItem('rimmet_last_view') || 'rim';
    return savedView === 'ivmet' && !canManageIvmet(currentUser)
      ? 'rim'
      : savedView;
  });

  const handleLogin = (user, selectedView) => {
    setCurrentUser(user);
    if (selectedView) setActiveView(selectedView);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    safeStorage.removeItem('rimmet_token');
    safeStorage.removeItem('rimmet_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const verifyToken = () => {
      if (!checkTokenValidity()) {
        handleLogout();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifyToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Revisar la validez del token periódicamente
    const intervalId = setInterval(verifyToken, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <>
        <AppToaster />
        <Suspense fallback={<ViewFallback />}>
          <LoginPage onLogin={handleLogin} />
        </Suspense>
      </>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'ivmet':
        return canManageIvmet(currentUser)
          ? <IvmetManagementPage onExit={() => setActiveView('calendar')} />
          : <RimFormPage currentUser={currentUser} />;
      case 'calendar':
        return <CalendarPage />;
      case 'departures':
        return <DeparturesPage />;
      case 'rim':
      default:
        return <RimFormPage currentUser={currentUser} />;
    }
  };

  return (
    <AppContent
      activeView={activeView}
      setActiveView={setActiveView}
      currentUser={currentUser}
      handleLogout={handleLogout}
      renderView={renderView}
    />
  );
}

export default App;
