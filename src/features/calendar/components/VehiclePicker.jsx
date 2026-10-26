import React from 'react';
import { Car, Check, CheckCircle2, ChevronDown, CircleX } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

export function VehiclePicker({
  vehicles,
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
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left shadow-xs transition-colors hover:border-fg/20"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Car size={17} className={cn('shrink-0', selectedHasConflict ? 'text-danger' : selectedVehicle ? 'text-fg' : 'text-fg-muted')} />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-fg">Vehículo del servicio</span>
            <span className={cn(
              'block truncate text-xs',
              selectedHasConflict ? 'text-danger' : selected ? 'text-fg-muted' : 'text-fg-subtle'
            )}>
              {selected ? `${selected.nombre}${selectedHasConflict ? ' · No disponible' : ' · Disponible'}` : 'Sin vehículo asignado'}
            </span>
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-muted transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      {selectedHasConflict && (
        <p role="alert" className="mt-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2 text-xs leading-4 text-danger">
          Se solapa con “{selectedStatus.conflict.label}” de {selectedStatus.conflict.start} a {selectedStatus.conflict.end}. Elige otro vehículo u horario.
        </p>
      )}

      <div className={`task-disclosure ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
        <div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface p-1">
          {vehicles.length === 0 ? (
            <p className="p-3 text-center text-xs text-fg-muted">
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
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                  isSelected
                    ? isUnavailable ? 'bg-danger/[0.08]' : 'bg-fg/[0.06]'
                    : 'hover:bg-fg/[0.04]'
                )}
              >
                <span className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  isSelected
                    ? isUnavailable ? 'border-danger bg-danger text-canvas' : 'border-accent bg-accent text-accent-fg'
                    : isUnavailable ? 'border-danger/40' : 'border-line-strong'
                )}>
                  {isSelected && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-medium', isUnavailable && !isSelected ? 'text-fg-muted' : 'text-fg')}>{vehicle.nombre}</span>
                  <span className={cn('block truncate text-[11px]', isUnavailable ? 'text-danger' : 'text-success')}>
                    {isUnavailable
                      ? `Ocupado ${status.conflict.start}–${status.conflict.end} · ${status.conflict.label}`
                      : 'Disponible en este horario'}
                  </span>
                </span>
                {isUnavailable
                  ? <CircleX className="h-4 w-4 shrink-0 text-danger" />
                  : <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
