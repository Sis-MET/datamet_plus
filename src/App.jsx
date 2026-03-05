import React, { useState } from 'react';
import { Header } from './shared/components/layout/Header';
import { Footer } from './shared/components/layout/Footer';
import { RimFormPage } from './features/rim/RimFormPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { LoginPage } from './features/auth/LoginPage';

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

  const [activeView, setActiveView] = useState('rim');

  const handleLogin = (user) => {
    setCurrentUser(user);
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
    <div className="min-h-screen bg-[#141414] pb-12">
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Spacer para compensar el header fixed */}
      <div className="h-20" />

      {renderView()}

      <Footer />
    </div>
  );
}

export default App;
