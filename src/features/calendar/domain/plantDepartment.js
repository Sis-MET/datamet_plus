// El primer dígito del sufijo del código de planta indica el departamento:
// «0032-21» es Cochabamba. Es más confiable que la dirección, que es texto libre
// y puede nombrar otro departamento («AV. BENI» en Santa Cruz).
const DEPARTMENTS_BY_DIGIT = {
  1: { code: 'LPZ', name: 'La Paz' },
  2: { code: 'CBB', name: 'Cochabamba' },
  3: { code: 'SCZ', name: 'Santa Cruz' },
  4: { code: 'ORU', name: 'Oruro' },
  5: { code: 'PTS', name: 'Potosí' },
  6: { code: 'TJA', name: 'Tarija' },
  7: { code: 'PND', name: 'Pando' },
  8: { code: 'CHQ', name: 'Chuquisaca' },
  9: { code: 'BEN', name: 'Beni' },
};

/** Departamento de un código de planta, o null si el código no lo indica. */
export const getPlantDepartment = (plantCode) => {
  const match = String(plantCode || '').trim().match(/^\d+\s*-\s*([1-9])/);
  return match ? DEPARTMENTS_BY_DIGIT[match[1]] : null;
};
