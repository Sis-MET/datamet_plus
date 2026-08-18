import React, { useState, useRef, useEffect } from 'react';
import logoMetrica from '../../../assets/logo_metrica.svg';
import { LogOut, User, LayoutGrid, ChevronDown, Menu, X } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export function Header({ activeView, onViewChange, currentUser, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setIsUserMenuOpen(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) setIsMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewChange = (view) => {
    safeStorage.setItem('rimmet_last_view', view);
    onViewChange?.(view);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleLogoutAndClose = () => {
    setIsMobileMenuOpen(false);
    onLogout?.();
  };

  return (
    <header className="fixed top-2 left-2 right-2 z-50 sm:top-3 sm:left-4 sm:right-4">
      <div className="max-w-7xl mx-auto">
        <div
          className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2.5 shadow-2xl shadow-black/40 sm:px-4"
          style={{
            background: 'rgba(18, 18, 20, 0.58)',
            backdropFilter: 'blur(9px) saturate(1.12)',
            WebkitBackdropFilter: 'blur(9px) saturate(1.12)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 select-none gap-3">
            <img src={logoMetrica} alt="Métrica LTDA" className="h-8 w-auto object-contain" />
            <div className="hidden border-l border-white/10 pl-3 md:block">
              <h1 className="text-[15px] font-semibold leading-none tracking-wide text-white">
                {activeView === 'rim' ? 'FORMULARIO RIM' : activeView === 'departures' ? 'SALIDAS DEL PERSONAL' : 'CRONOGRAMA METRICA'}
              </h1>
            </div>
          </div>

          {/* ── Desktop: controles (sm+) ── */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Usuario */}
            {currentUser && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((o) => !o)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                    isUserMenuOpen
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/8 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">{currentUser.usuario}</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 opacity-70 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-48 origin-top-right overflow-hidden rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150"
                    style={{ background: 'rgba(22,22,28,0.94)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                  >
                    <div className="p-2 flex flex-col gap-1">
                      <div className="mb-1 border-b border-white/10 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sesión iniciada</p>
                        <p className="truncate text-xs font-semibold text-white">{currentUser.usuario}</p>
                      </div>
                      {onLogout && (
                        <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10">
                          <LogOut className="h-4 w-4" /><span>Cerrar Sesión</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Módulo */}
            {currentUser && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  title="Cambiar Módulo"
                  className="flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-xs font-medium text-slate-400 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden lg:inline">{activeView === 'rim' ? 'Formulario RIM' : activeView === 'departures' ? 'Salidas del Personal' : 'Calendario'}</span>
                  <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-gray-700/50 bg-[#1e1e24]/95 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    <button onClick={() => handleViewChange('rim')} className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-colors ${activeView === 'rim' ? 'bg-primary-500/10 text-primary-400' : 'text-slate-200 hover:bg-white/5'}`}>
                      Formulario RIM
                    </button>
                    <button onClick={() => handleViewChange('calendar')} className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-colors ${activeView === 'calendar' ? 'bg-green-500/10 text-green-400' : 'text-slate-200 hover:bg-white/5'}`}>
                      Cronograma Metrica
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Mobile: botón hamburguesa (< sm) ── */}
          {currentUser && (
            <div className="flex sm:hidden items-center gap-2" ref={mobileMenuRef}>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <button
                onClick={() => setIsMobileMenuOpen((o) => !o)}
                  className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 ${
                    isMobileMenuOpen
                    ? 'bg-white/15 border-white/25'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                aria-label="Menú"
              >
                {isMobileMenuOpen
                  ? <X className="h-5 w-5 text-white" />
                  : <Menu className="h-5 w-5 text-white" />
                }
              </button>

              {isMobileMenuOpen && (
                <div
                  className="absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right"
                  style={{
                    background: 'rgba(22,22,28,0.96)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Info usuario */}
                  <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                      <User className="h-4 w-4 text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sesión activa</p>
                      <p className="truncate text-sm font-semibold text-white">{currentUser.usuario}</p>
                    </div>
                  </div>

                  <div className="p-2 flex flex-col gap-0.5">
                    {/* Módulo selector */}
                    <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Módulo</p>
                    <button onClick={() => handleViewChange('rim')} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${activeView === 'rim' ? 'bg-primary-500/15 text-primary-400' : 'text-slate-200 hover:bg-white/8'}`}>
                      <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0" />Formulario RIM
                    </button>
                    <button onClick={() => handleViewChange('calendar')} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${activeView === 'calendar' ? 'bg-green-500/15 text-green-400' : 'text-slate-200 hover:bg-white/8'}`}>
                      <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0" />Cronograma Metrica
                    </button>

                    <div className="my-1 h-px w-full bg-white/10" />

                    {/* Cerrar sesión */}
                    {onLogout && (
                      <button onClick={handleLogoutAndClose} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10">
                        <LogOut className="h-4 w-4" /><span>Cerrar Sesión</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
