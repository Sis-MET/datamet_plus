/**
 * Valoraciones de los informes de Soporte técnico y su símbolo.
 *
 * ServiceMET guarda los estados como «Bueno», «Regular», «Malo» y «No aplica»
 * (las versiones anteriores, como «1 Bueno», «2 Aceptable», «3 Malo» y
 * «4 No aplica»), y los ajustes como «Sí», «Se intentó», «No» o «No aplica».
 * Como en las macros de las plantillas Excel, todos se imprimen con su
 * símbolo: ✓ verde, ⚠ ámbar, ✗ rojo y ⊘ gris.
 */

export const CLASES_VALORACION = {
  bueno: { label: 'Bueno', tone: 'success' },
  regular: { label: 'Regular', tone: 'warning' },
  malo: { label: 'Malo', tone: 'danger' },
  noaplica: { label: 'No aplica', tone: 'muted' },
};

/** Opciones del selector de estado, en el orden de la leyenda. */
export const OPCIONES_ESTADO = [
  { value: 'Bueno', clase: 'bueno' },
  { value: 'Regular', clase: 'regular' },
  { value: 'Malo', clase: 'malo' },
  { value: 'No aplica', clase: 'noaplica' },
];

/** Ajustes que registra ServiceMET (los últimos, de versiones anteriores). */
export const OPCIONES_AJUSTE = [
  'No aplica', 'Se ajusta', 'Se repara', 'Se cambia', 'Limpieza', 'Lubricación', 'Sí', 'Se intentó', 'No',
];

/** Tipo de servicio sugerido (recomendación), como en ServiceMET. */
export const OPCIONES_RECOMENDACION = [
  'Diagnostico', 'Mnt Preventivo Regular', 'Mnt Preventivo Avanzado', 'Mnt Correctivo',
  'Ajustes Metrológicos', 'Calibración', 'Sin recomendación',
];

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()
  // «1 Bueno», «2 Aceptable»…: el número de la versión anterior no cuenta.
  .replace(/^[1-4] /, '');

const CLASE_DE = new Map([
  ['bueno', 'bueno'], ['si', 'bueno'],
  ['regular', 'regular'], ['aceptable', 'regular'], ['se intento', 'regular'],
  ['malo', 'malo'], ['no', 'malo'],
  ['no aplica', 'noaplica'], ['n/a', 'noaplica'],
]);

/** 'bueno' | 'regular' | 'malo' | 'noaplica', o null si es otro texto. */
export function claseValoracion(valor) {
  if (valor === null || valor === undefined || typeof valor === 'number') return null;
  return CLASE_DE.get(normalizar(valor)) || null;
}

/** Valor del selector de estado que corresponde a un valor guardado. */
export function estadoDeValor(valor) {
  const clase = claseValoracion(valor);
  return clase ? CLASES_VALORACION[clase].label : null;
}
