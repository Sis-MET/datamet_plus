import React, { useState } from 'react';
import { Toaster } from 'sileo';
import { Header } from './shared/components/layout/Header';
import { RimFormPage } from './features/rim/RimFormPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { LoginPage } from './features/auth/LoginPage';
import bgImage from './assets/soporte_tecnico.svg';
import { safeStorage } from './shared/utils/storage';
import { ThemeProvider } from './shared/context/ThemeContext';

// ── Componente interno: puede leer el contexto de tema ──
function AppContent({ activeView, setActiveView, currentUser, handleLogout, renderView }) {
  return (
    <>
      <Toaster position="bottom-right" theme="dark" />
      {/* Background layer — siempre oscuro, sin cambios por el tema */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(20, 20, 20, 0.60), rgba(20, 20, 20, 0.80)), url(${bgImage})` }}
      />

      <div className="min-h-screen bg-transparent pb-12 relative z-0">
        <Header
          activeView={activeView}
          onViewChange={setActiveView}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <div className="h-20" />
        {renderView()}
      </div>
    </>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!safeStorage.getItem('rimmet_token');
  });
  const [currentUser, setCurrentUser] = useState(() => {
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

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'calendar':
        return <CalendarPage />;
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
