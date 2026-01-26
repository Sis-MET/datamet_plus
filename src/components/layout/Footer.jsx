import React from 'react';
import isotipo from '../../assets/Isotipo_bn.png';

export function Footer() {
  return (
    <footer className="bg-[#141414] py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Isotipo */}
          <img 
            src={isotipo} 
            alt="Métrica LTDA" 
            className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity"
          />
          
          {/* Copyright */}
          <p className="text-sm text-gray-400">
            © 2026 Métrica LTDA. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
