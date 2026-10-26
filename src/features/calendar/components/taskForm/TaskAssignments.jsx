import { ChevronDown, Users } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { AdditionalResourcesPicker } from '../AdditionalResourcesPicker';
import { VehiclePicker } from '../VehiclePicker';

/** Vehículo y personal adicional de la ficha, plegados bajo un resumen. */
export function TaskAssignments({
  isOpen,
  onToggleOpen,
  vehicles,
  vehicleAvailability,
  selectedVehicle,
  showVehicles,
  onToggleVehicles,
  onSelectVehicle,
  grupos,
  additionalResources,
  showAdditionalUsers,
  onToggleAdditionalUsers,
  onToggleResource,
  onSelectArea,
}) {
  const selectedVehicleName = vehicles.find(vehicle => vehicle.id === selectedVehicle)?.nombre;
  const assignmentCount = additionalResources.length + (selectedVehicle ? 1 : 0);

  return (
    <div>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-fg/[0.05]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
            assignmentCount > 0 ? 'border-fg bg-fg text-canvas' : 'border-line bg-surface text-fg-muted'
          )}>
            <Users className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-fg">Asignaciones</span>
            <span className="block truncate text-xs text-fg-muted">
              {assignmentCount === 0
                ? 'Sin vehículo ni personal adicional'
                : `${selectedVehicleName || 'Sin vehículo'}${additionalResources.length ? ` · ${additionalResources.length} persona${additionalResources.length === 1 ? '' : 's'}` : ''}`}
            </span>
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-muted transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      <div className={`task-disclosure ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
        <div>
          <div className="space-y-2 pb-1 pt-2">
            <VehiclePicker
              vehicles={vehicles}
              isOpen={showVehicles}
              selectedVehicle={selectedVehicle}
              availability={vehicleAvailability}
              onToggleOpen={onToggleVehicles}
              onSelectVehicle={onSelectVehicle}
            />
            <AdditionalResourcesPicker
              grupos={grupos}
              isOpen={showAdditionalUsers}
              selectedResources={additionalResources}
              onToggleOpen={onToggleAdditionalUsers}
              onToggleResource={onToggleResource}
              onSelectArea={onSelectArea}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
