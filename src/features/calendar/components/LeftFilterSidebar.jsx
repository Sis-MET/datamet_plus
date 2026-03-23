import React, { useMemo } from 'react';
import { Filter, Users } from 'lucide-react';

export function LeftFilterSidebar({
  tecnicos = [],
  selectedArea,
  onSelectArea
}) {

  // Procesamos la matriz de técnicos para agrupar estadísticamente por área
  const areaStats = useMemo(() => {
    const stats = {};
    let totalActivos = 0;

    tecnicos.forEach(t => {
      // Formateamos las áreas vacías a "Sin Área" para que tengan un botón clicable
      const rawArea = typeof t.area === 'string' && t.area.trim() !== '' ? t.area.trim() : 'Sin Área';
      
      if (!stats[rawArea]) {
        stats[rawArea] = 0;
      }
      stats[rawArea]++;
      totalActivos++;
    });

    // Lo convertimos a un Array transitable y lo ordenamos alfabéticamente
    const areasArray = Object.keys(stats).map(areaName => ({
      name: areaName,
      count: stats[areaName]
    })).sort((a, b) => a.name.localeCompare(b.name));

    return { totalActivos, areasArray };
  }, [tecnicos]);

  return (
    <aside className="w-full xl:w-[260px] flex-shrink-0 bg-[#151518] rounded-3xl border border-gray-800/80 p-5 shadow-2xl relative overflow-hidden select-none">
      {/* Decorative ambient glow */}
      <div className="absolute top-[-50px] left-[-50px] w-[150px] h-[150px] bg-primary-500/5 blur-[60px] rounded-full pointer-events-none" />

      {/* Header del Filtro */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 bg-white/5 rounded-xl border border-white/10 shadow-inner">
          <Filter className="w-4 h-4 text-primary-400" />
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-gray-100 uppercase tracking-widest">Filtro</h2>
          <p className="text-[10px] text-gray-500 font-medium tracking-wide mt-0.5">Seleccionar área</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative z-10">
        {/* Botón ALL (Todas las Áreas) */}
        <button
          onClick={() => onSelectArea('Todas')}
          className={`flex items-center justify-between px-4 py-3 rounded-2xl text-[13px] font-bold transition-all duration-200 border shadow-sm ${
            selectedArea === 'Todas'
              ? 'bg-primary-500 text-white border-primary-400/50 shadow-primary-500/20 shadow-lg'
              : 'bg-[#1a1a1d] text-gray-400 border-white/5 hover:bg-white/5 hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 opacity-70" />
            <span>Todas las Áreas</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider ${
            selectedArea === 'Todas' ? 'bg-black/20 text-white' : 'bg-white/5 text-gray-500'
          }`}>
            {areaStats.totalActivos}
          </span>
        </button>

        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-700/50 to-transparent my-2" />

        {/* Dynamic Area List */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] xl:max-h-[calc(100vh-300px)] custom-scrollbar pr-1">
          {areaStats.areasArray.map(area => (
            <button
              key={area.name}
              onClick={() => onSelectArea(area.name)}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl text-[12px] font-bold transition-all duration-200 border ${
                selectedArea === area.name
                  ? 'bg-gray-800 text-primary-400 border-primary-500/30 shadow-md ring-1 ring-primary-500/20'
                  : 'bg-transparent text-gray-500 border-transparent hover:bg-[#1a1a1d] hover:text-gray-300 hover:border-white/5'
              }`}
            >
              <span className="truncate pr-2">{area.name}</span>
              <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-black tracking-wider flex-shrink-0 ${
                selectedArea === area.name ? 'bg-primary-500/10 text-primary-400' : 'bg-black/20 text-gray-600'
              }`}>
                {area.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Leyenda de Colores ── */}
      <div className="relative z-10 mt-5 pt-4 border-t border-white/5">
        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-3">Referencia de Colores</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500/70 flex-shrink-0 ring-1 ring-yellow-500/40" />
            <span className="text-[11px] text-gray-400 font-medium">Domingos y Feriados (no laborable)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-primary-500/70 flex-shrink-0 ring-1 ring-primary-500/40" />
            <span className="text-[11px] text-gray-400 font-medium">Día de Hoy</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-blue-500/70 flex-shrink-0 ring-1 ring-blue-500/40" />
            <span className="text-[11px] text-gray-400 font-medium">Información Vehículos</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
