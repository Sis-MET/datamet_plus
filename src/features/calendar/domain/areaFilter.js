// Filtro de áreas del cronograma. Lo guardado es «todas» ({ all: true }), para
// incluir las áreas que se creen después, o una lista ({ areas: [...] }).
import { normalizeArea } from './taskFormDomain';

export const getAreaLabel = (area) => (
  typeof area === 'string' && area.trim() !== '' ? area.trim() : 'Sin Área'
);

export const listAreas = (resources) => [...new Set(resources.map(resource => getAreaLabel(resource.area)))];

const findOwnArea = (areas, userArea) => {
  const wanted = normalizeArea(String(userArea || '').trim());
  return wanted ? areas.find(area => normalizeArea(area) === wanted) || null : null;
};

/**
 * Áreas marcadas: lo que la persona guardó o, si no guardó nada (o sus áreas ya
 * no existen), solo la suya. Quien no pertenece a ninguna área visible ve todas.
 */
export function resolveAreaSelection(saved, areas, userArea) {
  if (saved?.all) return areas;
  if (Array.isArray(saved?.areas)) {
    if (saved.areas.length === 0) return [];
    const current = areas.filter(area => saved.areas.includes(area));
    if (current.length > 0) return current;
  }
  const ownArea = findOwnArea(areas, userArea);
  return ownArea ? [ownArea] : areas;
}

export const toggleArea = (selected, area) => (
  selected.includes(area) ? selected.filter(item => item !== area) : [...selected, area]
);

/** «Todas» marca todas las casillas; con todas marcadas, las desmarca. */
export const toggleAllAreas = (selected, areas) => (
  areas.every(area => selected.includes(area)) ? [] : [...areas]
);

export const toSavedSelection = (selected, areas) => (
  selected.length > 0 && areas.every(area => selected.includes(area))
    ? { all: true }
    : { areas: selected }
);

/** Lee lo guardado; un valor dañado cuenta como si no hubiera nada. */
export function parseSavedSelection(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.all === true) return { all: true };
    if (Array.isArray(saved?.areas) && saved.areas.length > 0 && saved.areas.every(area => typeof area === 'string')) {
      return { areas: saved.areas };
    }
  } catch {
    // Se usa la selección por defecto.
  }
  return null;
}

export function filterResourcesByAreas(resources, selected) {
  const wanted = new Set(selected);
  return resources.filter(resource => wanted.has(getAreaLabel(resource.area)));
}
