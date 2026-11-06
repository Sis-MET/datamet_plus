// Patrones de calibración: piezas de los juegos de pesas y valores de sus
// certificados (migración 016). El servidor valida y avisa según la OIML R111;
// aquí solo se convierten unidades, números y lo que se pega desde Excel.

export const CLASES_R111 = ['E1', 'E2', 'F1', 'F2', 'M1', 'M1-2', 'M2', 'M2-3', 'M3'];

export const TIPOS_PATRON = [
  { value: 'PESAS', label: 'Juego de pesas' },
  { value: 'AMBIENTE', label: 'Condiciones ambientales' },
];

export const MAGNITUDES = [
  { id: 'T', label: 'Temperatura', unidad: '°C' },
  { id: 'HR', label: 'Humedad relativa', unidad: '%' },
  { id: 'P', label: 'Presión', unidad: 'hPa' },
];

export const UNIDADES_MASA = { mg: 1, g: 1e3, kg: 1e6 };

/**
 * Tipo de patrón según el nombre del instrumento (mismo criterio que el
 * servidor): juego de pesas, condiciones ambientales o ninguno.
 */
export const tipoPatronSugerido = (instrumento) => {
  const texto = String(instrumento || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (texto.includes('pesa')) return 'PESAS';
  if (/termo|higro|barom/.test(texto)) return 'AMBIENTE';
  return null;
};

export const ORIGENES_DENSIDAD = [
  { value: '', label: '—' },
  { value: 'MEDIDA', label: 'Medida' },
  { value: 'SUPUESTA', label: 'Supuesta' },
];

export const VERIFICACION = {
  SIN_VALORES: { label: 'Sin valores', tone: 'muted' },
  PENDIENTE: { label: 'Por verificar', tone: 'warning' },
  VERIFICADO: { label: 'Verificado', tone: 'success' },
};

/**
 * Número escrito a mano o pegado: acepta coma o punto decimal y, si trae los
 * dos, toma el punto como separador de miles («1.234,5»). '' → null; texto
 * que no es número → NaN.
 */
export const parseNumber = (text) => {
  let value = String(text ?? '').replace(/[\s\u00a0]/g, '');
  if (value === '') return null;
  if (value.includes(',') && value.includes('.')) value = value.replace(/\./g, '');
  value = value.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(value)) return Number.NaN;
  return Number(value);
};

/** Número para mostrar con coma decimal y sin ceros sobrantes. */
export const formatNumber = (value) => (
  value == null || Number.isNaN(Number(value)) ? '' : String(Number(Number(value).toPrecision(12))).replace('.', ',')
);

/** Valor nominal en mg → { valor, unidad } en la unidad más legible. */
export const splitNominal = (mg) => {
  const value = Number(mg);
  if (value >= UNIDADES_MASA.kg) return { valor: value / UNIDADES_MASA.kg, unidad: 'kg' };
  if (value >= UNIDADES_MASA.g) return { valor: value / UNIDADES_MASA.g, unidad: 'g' };
  return { valor: value, unidad: 'mg' };
};

export const toMg = (valor, unidad) => Number((valor * (UNIDADES_MASA[unidad] || 1)).toPrecision(15));

export const formatNominal = (mg) => {
  const { valor, unidad } = splitNominal(mg);
  return `${formatNumber(valor)} ${unidad}`;
};

/** «500 mg», «1 kg», «20» (sin unidad: la de la fila). */
export const parseNominalText = (text, unidadPorDefecto = 'g') => {
  const match = String(text ?? '').trim().match(/^([-+]?[\d.,\s]+)\s*(mg|g|kg)?$/i);
  if (!match) return null;
  const valor = parseNumber(match[1]);
  if (valor == null || Number.isNaN(valor)) return null;
  return { valor: match[1].trim(), unidad: (match[2] || unidadPorDefecto).toLowerCase() };
};

export const piezaKey = ({ nominalMg, identificacion }) => `${Number(nominalMg)}|${identificacion || ''}`;

export const piezaLabel = (pieza) => `${formatNominal(pieza.nominalMg)}${pieza.identificacion ? ` ${pieza.identificacion}` : ''}`;

/** Celdas pegadas desde Excel o un PDF: filas separadas por salto de línea y columnas por tabulador. */
export const parsePegado = (text) => {
  const lineas = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  if (lineas.length > 1 && lineas[lineas.length - 1] === '') lineas.pop();
  return lineas.map(linea => linea.split('\t'));
};

/** El texto pegado ocupa más de una celda. */
export const esPegadoMultiple = (text) => /[\t\n]/.test(String(text ?? '').replace(/\r?\n$/, ''));

/**
 * Pone las celdas pegadas en las filas a partir de (fila, columna). Las
 * columnas son los nombres de los campos en el orden de la tabla. Si faltan
 * filas y hay `nuevaFila`, las agrega; si no, descarta lo que sobra.
 */
export const pegarEnFilas = ({ filas, fila, columna, celdas, columnas, nuevaFila, asignar }) => {
  const inicio = columnas.indexOf(columna);
  if (inicio < 0) return filas;
  const resultado = [...filas];
  celdas.forEach((celdasFila, offset) => {
    const indice = fila + offset;
    if (indice >= resultado.length) {
      if (!nuevaFila) return;
      resultado.push(nuevaFila());
    }
    let actual = { ...resultado[indice] };
    celdasFila.forEach((texto, c) => {
      const campo = columnas[inicio + c];
      if (!campo) return;
      actual = asignar ? asignar(actual, campo, texto.trim()) : { ...actual, [campo]: texto.trim() };
    });
    resultado[indice] = actual;
  });
  return resultado;
};
