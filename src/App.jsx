import React, { useState } from 'react';
import { Toaster } from 'sileo';
import { Header } from './shared/components/layout/Header';
import { RimFormPage } from './features/rim/RimFormPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { LoginPage } from './features/auth/LoginPage';
import bgImage from './assets/soporte_tecnico.svg';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('rimmet_token');
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rimmet_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('rimmet_last_view') || 'rim';
  });

  const handleLogin = (user, selectedView) => {
    setCurrentUser(user);
    if (selectedView) setActiveView(selectedView);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('rimmet_token');
    localStorage.removeItem('rimmet_user');
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
    <>
      <Toaster position="bottom-right" theme="dark" />
      <div 
        className="min-h-screen bg-[#141414] pb-12 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `linear-gradient(rgba(20, 20, 20, 0.8), rgba(20, 20, 20, 0.95)), url(${bgImage})` }}
      >
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

export default App;
