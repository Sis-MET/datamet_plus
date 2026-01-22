import React from 'react';
import { Scale } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Scale className="h-8 w-8 text-primary-600" />
            <h1 className="ml-3 text-xl font-bold text-gray-900">RIM <span className="text-gray-500 font-normal">| Registro de Balanzas</span></h1>
          </div>
          <div className="text-sm text-gray-500 hidden sm:block">
            Sistema de Gestión de Entregas
          </div>
        </div>
      </div>
    </header>
  );
}
