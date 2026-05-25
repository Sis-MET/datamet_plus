import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import pkg from '../../../../package.json';

export function Footer() {
  const { isDarkGantt } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-4 mt-auto mb-4 px-4 w-full">
      <div className="max-w-7xl mx-auto flex justify-center">
        <div
          className={`flex items-center justify-center px-6 py-2.5 rounded-2xl shadow-xl ${isDarkGantt ? 'shadow-black/40' : 'shadow-gray-300/50'}`}
          style={{
            background: isDarkGantt ? 'rgba(18, 18, 20, 0.4)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${isDarkGantt ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)'}`
          }}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] sm:text-xs font-medium">
            <span className={`font-bold ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>
             Versión {pkg.version}
            </span>
            <span className={isDarkGantt ? 'text-gray-600' : 'text-gray-300'}>|</span>
            <span className={isDarkGantt ? 'text-gray-400' : 'text-gray-600'}>
              Desarrollado por <a href="https://lenash.dev" target="_blank" rel="noopener noreferrer" className={`hover:underline font-semibold ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>lenash.dev</a>
            </span>
            <span className={isDarkGantt ? 'text-gray-600' : 'text-gray-300'}>|</span>
            <span className={isDarkGantt ? 'text-gray-400' : 'text-gray-600'}>
              © Todos los derechos reservados METRICA LTDA, {currentYear}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
