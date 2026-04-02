import { format } from 'date-fns';

// Formato fijo de feriados inamovibles (MM-dd)
const FIXED_HOLIDAYS_BO = [
  '01-01', // Año Nuevo
  '01-22', // Día del Estado Plurinacional
  '04-03', // Viernes Santo
  '05-01', // Día del Trabajador
  '06-21', // Año Nuevo Aymara
  '08-06', // Día de la Independencia de Bolivia
  '11-02', // Día de los Difuntos
  '12-25', // Navidad
];

/**
 * Valida si un objeto Date cae en un día no laborable clásico para RRHH
 * @returns { isNonWorking: boolean, type: 'domingo' | 'feriado' | null }
 */
export function isNonWorkingDay(date) {
  if (!date) return { isNonWorking: false, type: null };
  
  // 1. ¿Es Domingo? Tratarlo igual que un feriado (color amarillo)
  if (date.getDay() === 0) return { isNonWorking: true, type: 'feriado' };
  
  // 2. ¿Cruza con un Feriado Nacional de Fecha Fija?
  const monthDay = format(date, 'MM-dd');
  if (FIXED_HOLIDAYS_BO.includes(monthDay)) return { isNonWorking: true, type: 'feriado' };
  
  // Día normal laborable
  return { isNonWorking: false, type: null };
}
