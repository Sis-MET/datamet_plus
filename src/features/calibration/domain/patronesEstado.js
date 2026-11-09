/**
 * Estado de los patrones para los certificados (Calibración › Certificados ›
 * Patrones): los pasos que lleva cada patrón hasta que sus cálculos dejan de
 * ser provisionales, y los filtros de la lista.
 */

// Pasos en el orden en que se resuelven; `codigo` es lo que falta si no está.
const PASOS = [
  { codigo: 'NO_EXISTE', label: 'En el gestor' },
  { codigo: 'SIN_TIPO', label: 'Tipo de patrón' },
  { codigo: 'SIN_PIEZAS', label: 'Piezas', soloPesas: true },
  { codigo: 'SIN_CERTIFICADO', label: 'Certificado vigente' },
  { codigo: 'SIN_VALORES', label: 'Valores transcritos' },
  { codigo: 'SIN_VERIFICAR', label: 'Verificados' },
];

// Si falta un paso, los que dependen de él quedan a la espera.
const DEPENDEN = {
  NO_EXISTE: ['SIN_TIPO', 'SIN_PIEZAS', 'SIN_CERTIFICADO', 'SIN_VALORES', 'SIN_VERIFICAR'],
  SIN_CERTIFICADO: ['SIN_VALORES', 'SIN_VERIFICAR'],
  SIN_VALORES: ['SIN_VERIFICAR'],
};

export const TIPOS = { PESAS: 'Juego de pesas', AMBIENTE: 'Termohigrómetro' };

/** Los pasos de un patrón: 'ok', 'falta' o 'espera' (depende de uno que falta), con su detalle. */
export const pasosDe = (patron) => {
  const faltan = new Set((patron.faltan || []).map(f => f.codigo));
  const enEspera = new Set([...faltan].flatMap(codigo => DEPENDEN[codigo] || []));
  return PASOS
    .filter(paso => !paso.soloPesas || patron.tipo === 'PESAS')
    .map((paso) => {
      let estado = 'ok';
      if (faltan.has(paso.codigo)) estado = 'falta';
      else if (enEspera.has(paso.codigo)) estado = 'espera';
      let detalle = null;
      if (paso.codigo === 'SIN_PIEZAS' && estado === 'ok') detalle = `${patron.piezas}`;
      if (paso.codigo === 'SIN_TIPO' && estado === 'ok' && patron.clase) detalle = `clase ${patron.clase}`;
      if (paso.codigo === 'SIN_CERTIFICADO' && estado === 'ok' && patron.certificado) {
        detalle = [patron.certificado.numero, patron.certificado.vence && `vence ${patron.certificado.vence}`].filter(Boolean).join(' · ');
      }
      return { ...paso, estado, detalle };
    });
};

const sinAcentos = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra por estado (TODOS, FALTAN, LISTOS), tipo y texto (código o instrumento). */
export const filtrarPatrones = (patrones, { estado = 'TODOS', tipo = 'TODOS', q = '' } = {}) => {
  const texto = sinAcentos(q).trim();
  return patrones.filter(p => (estado === 'TODOS' || (estado === 'LISTOS' ? p.listo : !p.listo))
    && (tipo === 'TODOS' || p.tipo === tipo)
    && (!texto || sinAcentos(`${p.codigo} ${p.instrumento || ''}`).includes(texto)));
};

/** El paso siguiente de un patrón (lo primero que le falta), para decir qué hacer. */
export const siguientePaso = patron => (patron.faltan || [])[0] || null;
