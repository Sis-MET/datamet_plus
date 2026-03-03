import { format } from 'date-fns';

/**
 * Genera un código RIM único basado en el área y timestamp.
 * Formato: RIM-{AREA}-{DDMMYY}-{HHMM}
 */
export function generateRIMCode(area, timestamp) {
  const areaCode = area.substring(0, 3).toUpperCase();
  const date = format(timestamp, 'ddMMyy');
  const time = format(timestamp, 'HHmm');
  return `RIM-${areaCode}-${date}-${time}`;
}
