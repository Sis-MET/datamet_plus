import React, { useState, useRef, useEffect } from 'react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { LogOut, User, LayoutGrid, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Header({ activeView, onViewChange, currentUser, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewChange = (view) => {
    localStorage.setItem('rimmet_last_view', view);
    onViewChange?.(view);
    setIsDropdownOpen(false);
  };
  return (
    <header className="fixed top-3 left-4 right-4 z-50">
      <div className="max-w-7xl mx-auto">
        <div
          className="flex items-center justify-between px-5 py-3 rounded-2xl shadow-2xl shadow-black/40"
          style={{
            background: 'rgba(18, 18, 20, 0.16)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 select-none">
            <img
              src={logoMetrica}
              alt="Métrica LTDA"
              className="h-9 w-auto object-contain"
            />
          </div>

          {/* Right side: button + usuario + logout */}
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
            {/* Selector de Módulo (Dropdown) */}
            {currentUser && (
              <div className="relative" ref={dropdownRef}>
                 <button
                   onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                   title="Cambiar Modulo"
                   className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
                 >
                   <LayoutGrid className="h-4 w-4" />
                   <span className="hidden sm:inline">
                     {activeView === 'rim' ? 'Formulario RIM' : 'Calendario'}
                   </span>
                   <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {isDropdownOpen && (
                   <div className="absolute top-full right-0 mt-2 w-48 bg-[#1e1e24] border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <button
                        onClick={() => handleViewChange('rim')}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/5 transition-colors ${activeView === 'rim' ? 'text-primary-400 bg-primary-500/10' : 'text-gray-300'}`}
                      >
                        Formulario RIM
                      </button>
                      <button
                        onClick={() => handleViewChange('calendar')}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/5 transition-colors ${activeView === 'calendar' ? 'text-green-400 bg-green-500/10' : 'text-gray-300'}`}
                      >
                        Calendario Métrica
                      </button>
                   </div>
                 )}
              </div>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
