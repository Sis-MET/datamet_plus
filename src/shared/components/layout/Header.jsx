import React from 'react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { LogOut, User, Home } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Header({ activeView, onViewChange, currentUser, onLogout }) {
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
          <div 
            className="flex items-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onViewChange?.('home')}
            title="Ir al Inicio"
          >
            <img
              src={logoMetrica}
              alt="Métrica LTDA"
              className="h-9 w-auto object-contain"
            />
          </div>

          {/* Nav contextual */}
          <nav className="flex items-center gap-1 justify-center absolute left-1/2 -translate-x-1/2">
            {activeView !== 'home' && (
              <button
                onClick={() => onViewChange?.('home')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all duration-200 shadow-lg"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Volver al Inicio</span>
              </button>
            )}
          </nav>

          {/* Right side: usuario + logout */}
          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <User className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
                <span className="text-xs text-gray-300 hidden sm:inline font-medium">
                  {currentUser.usuario}
                </span>
              </div>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
