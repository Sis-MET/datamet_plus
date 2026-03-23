import React from 'react';
import logoMetrica from '../../assets/logoMetrica2.png';

export function Header() {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-lg bg-[#141414]/10 border-b border-gray-700/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between gap-4 h-20 items-center">
          <div className="flex items-center flex-shrink-0">
            <img 
              src={logoMetrica} 
              alt="Métrica LTDA" 
              className="h-10 w-auto sm:h-12 md:h-14 object-contain transition-all duration-300"
            />
          </div>
          <div className="text-xs sm:text-sm md:text-base text-gray-300 font-medium text-right">
            NextMET
          </div>
        </div>
      </div>
    </header>
  );
}
