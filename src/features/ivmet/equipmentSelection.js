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
