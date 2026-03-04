import React from 'react';
import logoMetrica from '../../../assets/logoMetrica2.png';
import { ClipboardList, CalendarDays, BarChart3 } from 'lucide-react';
import { cn } from '../../utils/cn';

const NAV_ITEMS = [
  { id: 'rim', label: 'RIM', icon: ClipboardList },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  // { id: 'reports', label: 'Reportes', icon: BarChart3 }, // próxima fase
];

export function Header({ activeView, onViewChange }) {
  return (
    <header className="fixed top-3 left-4 right-4 z-50">
      <div className="max-w-7xl mx-auto">
        <div
          className="flex items-center justify-between px-5 py-3 rounded-2xl shadow-2xl shadow-black/40"
          style={{
            background: 'rgba(18, 18, 20, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <img
              src={logoMetrica}
              alt="Métrica LTDA"
              className="h-9 w-auto object-contain"
            />
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onViewChange?.(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  activeView === id
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/8'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Right side: badge de sesión */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400 hidden sm:inline font-medium">En línea</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
