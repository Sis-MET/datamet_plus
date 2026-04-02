import React, { useState, useRef, useEffect } from 'react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { LogOut, User, LayoutGrid, ChevronDown, Settings, Sun, Moon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { safeStorage } from '../../utils/storage';
import { useTheme } from '../../context/ThemeContext';

export function Header({ activeView, onViewChange, currentUser, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const settingsRef = useRef(null);

  const { isDarkGantt, toggleGanttTheme } = useTheme();

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewChange = (view) => {
    safeStorage.setItem('rimmet_last_view', view);
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
          <div className="flex items-center flex-shrink-0 select-none gap-4">
            <img
              src={logoMetrica}
              alt="Métrica LTDA"
              className="h-9 w-auto object-contain"
            />
            {/* Título dinámico por módulo */}
            <div className="hidden md:block border-l border-white/10 pl-4">
              <h1 className="text-[18px] font-semibold text-white leading-none tracking-wide">
                {activeView === 'rim' ? 'FORMULARIO RIM' : 'CRONOGRAMA METRICA'}
              </h1>
            </div>
          </div>

          {/* Right side */}
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

            {/* ── Botón de Ajustes ── */}
            {currentUser && (
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setIsSettingsOpen((o) => !o)}
                  title="Ajustes"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    isSettingsOpen
                      ? 'text-white bg-white/10 border-white/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/10 border-transparent hover:border-white/20'
                  }`}
                >
                  <Settings className={`h-4 w-4 transition-transform duration-300 ${isSettingsOpen ? 'rotate-45' : ''}`} />
                  <span className="hidden sm:inline">Ajustes</span>
                </button>

                {/* ── Tarjeta de Ajustes ── */}
                {isSettingsOpen && (
                  <div
                    className="absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
                    style={{
                      background: 'rgba(22, 22, 28, 0.96)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    {/* Header de la tarjeta */}
                    <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest">
                        Ajustes
                      </span>
                    </div>

                    {/* Opciones */}
                    <div className="p-3 flex flex-col gap-1">
                      {/* ── Switch Modo Claro/Oscuro Gantt ── */}
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-2.5">
                          {isDarkGantt
                            ? <Moon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                            : <Sun className="h-4 w-4 text-amber-400 flex-shrink-0" />
                          }
                          <div>
                            <p className="text-xs font-semibold text-gray-200 leading-none mb-0.5">
                              Modo de la grilla
                            </p>
                            <p className="text-[10px] text-gray-500 leading-none">
                              {isDarkGantt ? 'Oscuro (actual)' : 'Claro (actual)'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <button
                          role="switch"
                          aria-checked={!isDarkGantt}
                          onClick={toggleGanttTheme}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            !isDarkGantt
                              ? 'bg-amber-400'
                              : 'bg-white/15'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
                              !isDarkGantt ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Footer info */}
                    <div className="px-4 py-2 border-t border-white/5">
                      <p className="text-[10px] text-gray-600 text-center">
                        Solo afecta la grilla semanal
                      </p>
                    </div>
                  </div>
                )}
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
                        Cronograma Metrica
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
