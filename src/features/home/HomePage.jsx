import React from 'react';
import { ClipboardList, CalendarDays, ArrowRight } from 'lucide-react';

export function HomePage({ onViewChange, currentUser }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative pt-8">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Greeting Header */}
      <div className="mb-12 text-center sm:text-left">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
          ¡Hola, <span className="text-primary-100">{currentUser?.usuario || 'Usuario'}</span>!
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl">
          Bienvenido a NextMET. Selecciona a continuación la herramienta que deseas utilizar.
        </p>
      </div>

      {/* Cards Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        
        {/* Card: RIM */}
        <button
          onClick={() => onViewChange('rim')}
          className="group relative flex flex-col justify-between text-left p-8 rounded-3xl backdrop-blur-md bg-white/5 border border-white/10 shadow-xl hover:border-primary-500/50 hover:bg-white/10 hover:shadow-primary-500/10 hover:-translate-y-1 hover:backdrop-blur-lg transition-all duration-300 overflow-hidden"
        >
          {/* Card Highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          <div className="flex items-start justify-between mb-8">
            <div className="p-4 bg-primary-500/20 rounded-2xl text-primary-400 group-hover:scale-110 group-hover:bg-primary-500 group-hover:text-white transition-all duration-300">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div className="p-2 rounded-full bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-primary-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-primary-300 transition-colors">
              Formulario RIM
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Recepción de Registros de Instrumentos Métrica. Completa el formulario con los detalles del instrumento para generar el pdf correspondiente.
            </p>
          </div>
        </button>

        {/* Card: Calendario */}
        <button
          onClick={() => onViewChange('calendar')}
          className="group relative flex flex-col justify-between text-left p-8 rounded-3xl backdrop-blur-md bg-white/5 border border-white/10 shadow-xl hover:border-green-500/50 hover:bg-white/10 hover:shadow-green-500/10 hover:-translate-y-1 hover:backdrop-blur-lg transition-all duration-300 overflow-hidden"
        >
          {/* Card Highlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          <div className="flex items-start justify-between mb-8">
            <div className="p-4 bg-green-500/20 rounded-2xl text-green-400 group-hover:scale-110 group-hover:bg-green-500 group-hover:text-white transition-all duration-300">
              <CalendarDays className="w-8 h-8" />
            </div>
            <div className="p-2 rounded-full bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-green-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-green-300 transition-colors">
              Calendario Metrica
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Consulta y administra la agenda y planificación técnica. Visualiza actividades por vista semanal o mensual para coordinar en el terreno.
            </p>
          </div>
        </button>

      </div>
    </div>
  );
}
