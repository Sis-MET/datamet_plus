import React, { useState, useEffect } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { Header } from './shared/components/layout/Header';
import { Footer } from './shared/components/layout/Footer';
import { RimFormPage } from './features/rim/RimFormPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { DeparturesPage } from './features/departures/DeparturesPage';
import { LoginPage } from './features/auth/LoginPage';
import bgImage from './assets/soporte_tecnico.svg';
import { safeStorage } from './shared/utils/storage';
import { ThemeProvider, useTheme } from './shared/context/ThemeContext';

// ── Componente interno: puede leer el contexto de tema ──
function AppContent({ activeView, setActiveView, currentUser, handleLogout, renderView }) {
  const { isDarkGantt } = useTheme();

  return (
    <>
      <SonnerToaster 
        position="bottom-right" 
        theme={isDarkGantt ? 'dark' : 'light'}
        toastOptions={{
          className: isDarkGantt ? 'border-white/10' : 'border-gray-200',
          style: {
            background: isDarkGantt ? 'rgba(22, 22, 28, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: isDarkGantt ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.15)',
            color: isDarkGantt ? '#fff' : '#111827',
          }
        }}
        icons={{
          success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
          info: <Info className="w-5 h-5 text-blue-500" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          error: <AlertCircle className="w-5 h-5 text-red-500" />,
          loading: <Loader2 className="w-5 h-5 animate-spin text-gray-500" />,
        }}
      />
      {/* Background layer — siempre oscuro, sin cambios por el tema */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(20, 20, 20, 0.60), rgba(20, 20, 20, 0.80)), url(${bgImage})` }}
      />

      <div className="min-h-screen flex flex-col bg-transparent pb-2 relative z-0">
        <Header
          activeView={activeView}
          onViewChange={setActiveView}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <div className="h-20 flex-shrink-0" />
        <div className="flex-1">
          {renderView()}
        </div>
        <Footer />
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
    return safeStorage.getItem('rimmet_last_view') || 'rim';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (activeView) {
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
    <ThemeProvider>
      <AppContent
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        handleLogout={handleLogout}
        renderView={renderView}
      />
    </ThemeProvider>
  );
}

export default App;
