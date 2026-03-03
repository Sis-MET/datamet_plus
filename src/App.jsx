import React, { useState } from 'react';
import { Header } from './shared/components/layout/Header';
import { Footer } from './shared/components/layout/Footer';
import { RimFormPage } from './features/rim/RimFormPage';
import { CalendarPage } from './features/calendar/CalendarPage';

function App() {
  const [activeView, setActiveView] = useState('rim');

  const renderView = () => {
    switch (activeView) {
      case 'calendar':
        return <CalendarPage />;
      case 'rim':
      default:
        return <RimFormPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] pb-12">
      <Header activeView={activeView} onViewChange={setActiveView} />

      {/* Spacer para compensar el header fixed */}
      <div className="h-20" />

      {renderView()}

      <Footer />
    </div>
  );
}

export default App;
