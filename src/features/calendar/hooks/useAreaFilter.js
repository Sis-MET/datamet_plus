import { useCallback, useMemo, useState } from 'react';
import { safeStorage } from '../../../shared/utils/storage';
import {
  filterResourcesByAreas,
  getAreaLabel,
  listAreas,
  parseSavedSelection,
  resolveAreaSelection,
  toSavedSelection,
  toggleAllAreas as toggleAllAreasIn,
  toggleArea as toggleAreaIn,
} from '../domain/areaFilter';

const storageKey = (userKey) => `datamet_cronograma_areas_${userKey}`;

/** Áreas visibles del cronograma, recordadas por usuario en este navegador. */
export function useAreaFilter({ tecnicos, currentUserArea, userKey }) {
  const [selection, setSelection] = useState(() => parseSavedSelection(safeStorage.getItem(storageKey(userKey))));
  const areas = useMemo(() => listAreas(tecnicos), [tecnicos]);
  const selectedAreas = useMemo(
    () => resolveAreaSelection(selection, areas, currentUserArea),
    [areas, currentUserArea, selection]
  );
  const filteredTecnicos = useMemo(
    () => filterResourcesByAreas(tecnicos, selectedAreas),
    [selectedAreas, tecnicos]
  );

  const choose = useCallback((next) => {
    const saved = toSavedSelection(next, areas);
    setSelection(saved);
    // Sin ninguna marcada no se guarda: al volver no debe abrir un cronograma vacío.
    if (next.length === 0) safeStorage.removeItem(storageKey(userKey));
    else safeStorage.setItem(storageKey(userKey), JSON.stringify(saved));
  }, [areas, userKey]);

  const toggleArea = useCallback((area) => choose(toggleAreaIn(selectedAreas, area)), [choose, selectedAreas]);
  const toggleAllAreas = useCallback(() => choose(toggleAllAreasIn(selectedAreas, areas)), [areas, choose, selectedAreas]);

  /** Muestra la fila que pidió el buscador, sin cambiar la configuración guardada. */
  const revealResource = useCallback((resourceId) => {
    const resource = tecnicos.find(item => item.id === resourceId);
    if (!resource) return;
    const area = getAreaLabel(resource.area);
    if (!selectedAreas.includes(area)) setSelection(toSavedSelection([...selectedAreas, area], areas));
  }, [areas, selectedAreas, tecnicos]);

  return { filteredTecnicos, selectedAreas, toggleArea, toggleAllAreas, revealResource };
}
