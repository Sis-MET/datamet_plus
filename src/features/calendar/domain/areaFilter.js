// Filtro de áreas del cronograma. Una selección vacía significa «Todas».
import { isVehicleResource } from './vehicleAvailability';

export const getAreaLabel = (area) => (
  typeof area === 'string' && area.trim() !== '' ? area.trim() : 'Sin Área'
);

const isVehicleArea = (area) => isVehicleResource({ area });

/**
 * Marca o desmarca un área. Al empezar a filtrar por personal se suman los
 * vehículos, para planificar con ellos a la vista; se pueden desmarcar. Si ya
 * no queda personal marcado, o se marcaron todas las áreas, vuelve a «Todas».
 */
export function toggleAreaSelection(selected, area, allAreas) {
  if (selected.includes(area)) {
    const remaining = selected.filter(item => item !== area);
    return remaining.every(isVehicleArea) ? [] : remaining;
  }

  const base = selected.length === 0 && !isVehicleArea(area)
    ? allAreas.filter(isVehicleArea)
    : selected;
  const next = [...new Set([...base, area])];
  return allAreas.every(item => next.includes(item)) ? [] : next;
}

export function filterResourcesByAreas(resources, selected) {
  if (selected.length === 0) return resources;
  const wanted = new Set(selected);
  return resources.filter(resource => wanted.has(getAreaLabel(resource.area)));
}
