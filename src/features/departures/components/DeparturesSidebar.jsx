import React from 'react';
import { useTheme } from '../../../shared/context/ThemeContext';
import { Filter, Search } from 'lucide-react';

export function DeparturesSidebar() {
  const { isDarkGantt } = useTheme();

  return (
    <div className={`w-full lg:w-64 flex-shrink-0 flex flex-col gap-4 p-4 rounded-3xl border shadow-xl ${isDarkGantt ? 'bg-[#1a1a20] border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className={`flex items-center gap-2 pb-3 border-b ${isDarkGantt ? 'border-gray-800' : 'border-gray-100'}`}>
        <Filter className={`h-4 w-4 ${isDarkGantt ? 'text-purple-400' : 'text-purple-600'}`} />
        <h2 className={`font-bold text-sm tracking-wide ${isDarkGantt ? 'text-white' : 'text-gray-900'}`}>Filtros</h2>
      </div>

      <div className="flex flex-col gap-3">
        <label className={`text-xs font-semibold uppercase tracking-wider ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>Buscar Personal</label>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDarkGantt ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Nombre..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-all ${
              isDarkGantt 
                ? 'bg-white/5 border border-white/10 text-white focus:border-purple-500 focus:bg-white/10' 
                : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-purple-500 focus:bg-white'
            }`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <label className={`text-xs font-semibold uppercase tracking-wider ${isDarkGantt ? 'text-gray-500' : 'text-gray-500'}`}>Estado</label>
        <div className="flex flex-col gap-2">
          {['Todos', 'En curso', 'Finalizada'].map(status => (
            <label key={status} className={`flex items-center gap-2 cursor-pointer p-2 rounded-xl transition-colors ${isDarkGantt ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
              <input type="radio" name="status" defaultChecked={status === 'Todos'} className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 focus:ring-2" />
              <span className={`text-sm font-medium ${isDarkGantt ? 'text-gray-300' : 'text-gray-700'}`}>{status}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
