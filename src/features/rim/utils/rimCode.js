/**
 * Genera un código RIM único basado en el cliente y planta seleccionados.
 * Formato: RIM-{CODIGO_CLIENTE}-{CODIGO_PLANTA}-{GESTION}
 * Si no hay cliente/planta, muestra un placeholder.
 */
export function generateRIMCode(clienteCode, plantaCode, gestion = new Date().getFullYear()) {
  const year2 = String(gestion).slice(-2);
  
  // Si hay código de planta (ej: "0103-11"), ese código ya incluye cliente,
  // por tanto el RIM final solo requiere la planta y la gestión
  if (plantaCode) {
    return `RIM-${plantaCode}-${year2}`;
  }
  
  const finalCliente = clienteCode || 'XXXX';
  return `RIM-${finalCliente}-XX-${year2}`;
}
