/** Certificados emitidos (Calibración › Certificados › Emitidos): filtros y textos. */

export const ESTADOS_CERTIFICADO = {
  VIGENTE: { label: 'Vigente', tone: 'success', descripcion: 'Firmado y entregado' },
  POR_FIRMAR: { label: 'Por firmar', tone: 'warning', descripcion: 'Autorizado; falta subir el PDF firmado' },
  ANULADO: { label: 'Anulado', tone: 'muted', descripcion: 'Autorización anulada antes de firmar' },
};

export const ESTADOS_EMISION_TEXTO = {
  EMITIDO: 'Vigente',
  REEMPLAZADO: 'Reemplazada',
  AUTORIZADO: 'Por firmar',
  ANULADO: 'Anulada',
};

const sinAcentos = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const textoInstrumento = (i = {}) => [i.tipo, i.marca, i.modelo].filter(Boolean).join(' · ');

export const capacidad = (i = {}) => (i.max ? `${i.max}${i.unidad ? ` ${i.unidad}` : ''}` : '');

/** Emisión 1 → «01». */
export const textoEmision = n => String(n ?? '').padStart(2, '0');

/** Años de los certificados, del más reciente al más antiguo. */
export const aniosDe = certificados => [...new Set(certificados.map(c => c.anio).filter(Boolean))].sort((a, b) => b - a);

/**
 * Filtra por texto (n.º, cliente, instrumento, ID., serie o código del
 * servicio, sin tildes ni mayúsculas), por estado y por año.
 */
export const filtrarEmitidos = (certificados, { q = '', estado = 'TODOS', anio = null } = {}) => {
  const palabras = sinAcentos(q).split(/\s+/).filter(Boolean);
  return certificados.filter((c) => {
    if (estado !== 'TODOS' && c.estado !== estado) return false;
    if (anio && c.anio !== anio) return false;
    if (!palabras.length) return true;
    const texto = sinAcentos([c.numero, c.cliente, c.codigo, textoInstrumento(c.instrumento), c.instrumento?.id, c.instrumento?.serie].join(' '));
    return palabras.every(p => texto.includes(p));
  });
};

/** Cuántos hay de cada estado entre los certificados (para los filtros). */
export const contarEstados = certificados => certificados.reduce(
  (cuenta, c) => ({ ...cuenta, [c.estado]: (cuenta[c.estado] || 0) + 1, TODOS: cuenta.TODOS + 1 }),
  { TODOS: 0, VIGENTE: 0, POR_FIRMAR: 0, ANULADO: 0 },
);
