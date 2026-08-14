import React from 'react';
import { Car, Check, CheckCircle2, ChevronDown, CircleX } from 'lucide-react';

export function VehiclePicker({
  vehicles,
  isDarkGantt,
  isOpen,
  selectedVehicle,
  availability = {},
  onToggleOpen,
  onSelectVehicle,
}) {
  const selected = vehicles.find(vehicle => vehicle.id === selectedVehicle);
  const selectedStatus = selectedVehicle ? availability[selectedVehicle] : null;
  const selectedHasConflict = Boolean(selectedStatus && !selectedStatus.available);

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className={`flex min-h-11 items-center justify-between gap-3 w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
          isDarkGantt
            ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-gray-200'
            : 'bg-slate-100/65 border-slate-500/20 hover:bg-white/55 text-slate-800'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Car size={16} className={selectedHasConflict ? 'shrink-0 text-red-500' : selectedVehicle ? 'shrink-0 text-blue-500' : 'shrink-0 opacity-70'} />
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider">Vehículo del servicio</span>
            <span className={`block truncate text-xs font-medium ${
              selectedHasConflict
                ? isDarkGantt ? 'text-red-300' : 'text-red-700'
                : selected ? '' : isDarkGantt ? 'text-gray-400' : 'text-slate-500'
            }`}>
              {selected ? `${selected.nombre}${selectedHasConflict ? ' · No disponible' : ' · Disponible'}` : 'Sin vehículo asignado'}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {selectedHasConflict && (
        <p role="alert" className={`mt-2 rounded-lg px-3 py-2 text-[11px] leading-4 ${
          isDarkGantt ? 'bg-red-500/10 text-red-200' : 'bg-red-50 text-red-700'
        }`}>
          Se solapa con “{selectedStatus.conflict.label}” de {selectedStatus.conflict.start} a {selectedStatus.conflict.end}. Elige otro vehículo u horario.
        </p>
      )}

      <div className={`task-disclosure ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
        <div>
          <div className={`mt-2 max-h-44 overflow-y-auto rounded-xl border p-1.5 custom-scrollbar ${
            isDarkGantt ? 'bg-[#111216] border-white/10' : 'bg-slate-100/90 border-slate-500/20 shadow-sm'
          }`}>
          {vehicles.length === 0 ? (
            <p className={`p-3 text-center text-xs ${isDarkGantt ? 'text-gray-400' : 'text-slate-500'}`}>
              No hay vehículos disponibles
            </p>
          ) : vehicles.map(vehicle => {
            const isSelected = vehicle.id === selectedVehicle;
            const status = availability[vehicle.id] || { available: true, conflict: null };
            const isUnavailable = !status.available;
            return (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => onSelectVehicle(isSelected ? '' : vehicle.id)}
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isSelected
                    ? isUnavailable
                      ? isDarkGantt ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-800'
                      : isDarkGantt ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-50 text-blue-800'
                    : isUnavailable
                      ? isDarkGantt ? 'text-gray-500 hover:bg-red-500/10' : 'text-slate-400 hover:bg-red-50'
                    : isDarkGantt ? 'text-gray-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? isUnavailable ? 'border-red-500 bg-red-500' : 'border-blue-500 bg-blue-500'
                    : isUnavailable
                      ? isDarkGantt ? 'border-red-500/40' : 'border-red-300'
                      : isDarkGantt ? 'border-gray-500' : 'border-slate-300'
                }`}>
                  {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{vehicle.nombre}</span>
                  <span className={`block truncate text-[10px] ${
                    isUnavailable
                      ? isDarkGantt ? 'text-red-300/80' : 'text-red-600'
                      : isDarkGantt ? 'text-emerald-300/80' : 'text-emerald-700'
                  }`}>
                    {isUnavailable
                      ? `Ocupado ${status.conflict.start}–${status.conflict.end} · ${status.conflict.label}`
                      : 'Disponible en este horario'}
                  </span>
                </span>
                {isUnavailable
                  ? <CircleX className="h-4 w-4 shrink-0 text-red-500" />
                  : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
