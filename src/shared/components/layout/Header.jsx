import React, { useState, useRef, useEffect } from 'react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { LogOut, User, LayoutGrid, ChevronDown, Settings, Sun, Moon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { safeStorage } from '../../utils/storage';
import { useTheme } from '../../context/ThemeContext';

export function Header({ activeView, onViewChange, currentUser, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const settingsRef = useRef(null);
  const userMenuRef = useRef(null);

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
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
          className={`flex items-center justify-between px-5 py-3 rounded-2xl shadow-2xl ${isDarkGantt ? 'shadow-black/40' : 'shadow-gray-300/50'}`}
          style={{
            background: isDarkGantt ? 'rgba(18, 18, 20, 0.16)' : 'rgba(255, 255, 255, 0.85)',
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
            <div className={`hidden md:block border-l pl-4 ${isDarkGantt ? 'border-white/10' : 'border-gray-300'}`}>
              <h1 className={`text-[18px] font-semibold leading-none tracking-wide ${isDarkGantt ? 'text-white' : 'text-gray-800'}`}>
                {activeView === 'rim' ? 'FORMULARIO RIM' : 'CRONOGRAMA METRICA'}
              </h1>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Usuario (Dropdown) */}
            {currentUser && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((o) => !o)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                    isUserMenuOpen
                      ? (isDarkGantt ? 'bg-white/10 border-white/20' : 'bg-gray-200 border-gray-300')
                      : (isDarkGantt ? 'bg-white/5 border-white/8 hover:bg-white/10 hover:border-white/20' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 hover:border-gray-300')
                  }`}
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <User className={`h-3.5 w-3.5 hidden sm:block ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`text-xs hidden sm:inline font-medium ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
                    {currentUser.usuario}
                  </span>
                  <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''} ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>

                {isUserMenuOpen && (
                  <div
                    className={`absolute top-full right-0 mt-2 w-48 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden border animate-in fade-in zoom-in-95 duration-150 origin-top-right ${isDarkGantt ? 'border-white/10' : 'border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.1)]'}`}
                    style={{
                      background: isDarkGantt ? 'rgba(22, 22, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    <div className="p-2 flex flex-col gap-1">
                      <div className={`px-3 py-2 border-b mb-1 ${isDarkGantt ? 'border-white/10' : 'border-gray-200'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>Sesión iniciada</p>
                        <p className={`text-xs font-semibold truncate ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>{currentUser.usuario}</p>
                      </div>

                      {onLogout && (
                        <button
                          onClick={onLogout}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                            isDarkGantt
                              ? 'text-red-400 hover:bg-red-500/10'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Cerrar Sesión</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
                      ? (isDarkGantt ? 'text-white bg-white/10 border-white/20' : 'text-gray-900 bg-gray-200 border-gray-300')
                      : (isDarkGantt ? 'text-gray-400 hover:text-white hover:bg-white/10 border-transparent hover:border-white/20' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent hover:border-gray-300')
                  }`}
                >
                  <Settings className={`h-4 w-4 transition-transform duration-300 ${isSettingsOpen ? 'rotate-45' : ''}`} />
                  <span className="hidden sm:inline">Ajustes</span>
                </button>

                {/* ── Tarjeta de Ajustes ── */}
                {isSettingsOpen && (
                  <div
                    className={`absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden border animate-in fade-in zoom-in-95 duration-150 origin-top-right ${isDarkGantt ? 'border-white/10' : 'border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.1)]'}`}
                    style={{
                      background: isDarkGantt ? 'rgba(22, 22, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    {/* Header de la tarjeta */}
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDarkGantt ? 'border-white/8' : 'border-gray-200'}`}>
                      <Settings className={`h-3.5 w-3.5 ${isDarkGantt ? 'text-gray-400' : 'text-gray-500'}`} />
                      <span className={`text-xs font-semibold uppercase tracking-widest ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
                        Ajustes
                      </span>
                    </div>

                    {/* Opciones */}
                    <div className="p-3 flex flex-col gap-1">
                      {/* ── Switch Modo Claro/Oscuro Gantt ── */}
                      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group ${isDarkGantt ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}>
                        <div className="flex items-center gap-2.5">
                          {isDarkGantt
                            ? <Moon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                            : <Sun className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          }
                          <div>
                            <p className={`text-xs font-semibold leading-none mb-0.5 ${isDarkGantt ? 'text-gray-200' : 'text-gray-800'}`}>
                              Modo del sistema
                            </p>
                            <p className={`text-[10px] leading-none ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>
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
                    <div className={`px-4 py-2 border-t ${isDarkGantt ? 'border-white/5' : 'border-gray-200'}`}>
                      <p className={`text-[10px] text-center ${isDarkGantt ? 'text-gray-600' : 'text-gray-500'}`}>
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
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    isDarkGantt 
                      ? 'text-gray-400 hover:text-white hover:bg-white/10 border-transparent hover:border-white/20' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent hover:border-gray-300'
                   }`}
                 >
                   <LayoutGrid className="h-4 w-4" />
                   <span className="hidden sm:inline">
                     {activeView === 'rim' ? 'Formulario RIM' : 'Calendario'}
                   </span>
                   <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {isDropdownOpen && (
                   <div className={`absolute top-full right-0 mt-2 w-48 border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
                     isDarkGantt ? 'bg-[#1e1e24] border-gray-700/50' : 'bg-white border-gray-200 shadow-gray-200/50'
                   }`}>
                      <button
                        onClick={() => handleViewChange('rim')}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                          activeView === 'rim' 
                            ? (isDarkGantt ? 'text-primary-400 bg-primary-500/10' : 'text-primary-600 bg-primary-50/50') 
                            : (isDarkGantt ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50')
                        }`}
                      >
                        Formulario RIM
                      </button>
                      <button
                        onClick={() => handleViewChange('calendar')}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                          activeView === 'calendar' 
                            ? (isDarkGantt ? 'text-green-400 bg-green-500/10' : 'text-green-600 bg-green-50/50') 
                            : (isDarkGantt ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50')
                        }`}
                      >
                        Cronograma Metrica
                      </button>
                   </div>
                 )}
              </div>
            )}


          </div>
        </div>
      </div>
    </header>
  );
}
