// El catálogo determina qué equipos pueden incorporarse; aquí solo agrupamos
// ese alcance. Nunca se generan códigos ni se incorporan otras plantas.
export function groupEquipment(catalog, selectedPlants) {
  const selected = new Set(selectedPlants);
  return (catalog?.plants || [])
    .filter((plant) => selected.has(plant.code))
    .map((plant) => ({
      ...plant,
      equipment: (catalog.equipment || []).filter(
        (item) => item.code.slice(0, 7) === plant.code
      ),
    }));
}

export function selectionState(codes, selected, locked = []) {
  const chosen = new Set(selected);
  const fixed = new Set(locked);
  const unique = [...new Set(codes)];
  const count = unique.filter((code) => chosen.has(code)).length;
  return {
    count,
    total: unique.length,
    checked: unique.length > 0 && count === unique.length,
    indeterminate: count > 0 && count < unique.length,
    disabled: !unique.some((code) => !fixed.has(code)),
  };
}

export function selectEquipment(selected, codes, checked, locked = []) {
  const result = new Set([...selected, ...locked]);
  const fixed = new Set(locked);
  for (const code of codes) {
    if (checked) result.add(code);
    else if (!fixed.has(code)) result.delete(code);
  }
  return [...result];
}

// Habilitación en lote desde la ficha del cliente: solo balanzas activas,
// validadas y sin habilitar. El servidor aplica las mismas reglas y rechaza el
// lote completo si alguna no cumple.
export const canEnable = (equipment) =>
  equipment.activo !== false &&
  equipment.estado_catalogo === 'READY' &&
  !equipment.habilitado;

// Pendientes agrupadas por planta; las suspendidas van aparte porque fueron una
// decisión explícita y no deben reactivarse con "seleccionar todas".
export function enableCandidates(items, plants = [], search = '') {
  const text = search.trim().toLowerCase();
  const visible = items.filter(
    (e) =>
      canEnable(e) &&
      (!text ||
        [e.cod_metrica, e.instrumento, e.marca, e.modelo, e.serie]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(text)))
  );
  const groups = new Map();
  for (const e of visible.filter(
    (item) => item.estado_configuracion !== 'SUSPENDED'
  )) {
    if (!groups.has(e.planta_id)) {
      const plant = plants.find((p) => p.id === e.planta_id);
      groups.set(e.planta_id, {
        id: e.planta_id,
        code: plant?.legacy_codigo_planta || '',
        name: plant?.nombre || 'Planta',
        equipment: [],
      });
    }
    groups.get(e.planta_id).equipment.push(e);
  }
  return {
    groups: [...groups.values()].sort((a, b) => a.code.localeCompare(b.code)),
    suspended: visible.filter((e) => e.estado_configuracion === 'SUSPENDED'),
  };
}
