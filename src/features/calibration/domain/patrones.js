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

// ─── Error o corrección de los termohigrómetros ─────────────────────────────

/** Lo que da el certificado en cada punto: la corrección o el error de indicación. */
export const EXPRESIONES = [
  { value: 'CORRECCION', label: 'Corrección' },
  { value: 'ERROR', label: 'Error' },
];

/**
 * Pasa entre la corrección que usa el cálculo y el valor que escribe el
 * certificado: el error es la corrección con el signo cambiado. Sirve en los
 * dos sentidos.
 */
export const cambiarExpresion = (valor, expresadoComo) => {
  if (valor == null || Number.isNaN(valor)) return valor;
  return expresadoComo === 'ERROR' ? (valor === 0 ? 0 : -valor) : valor;
};

/** Lo que da el certificado de una magnitud según sus puntos guardados; sin puntos, `porDefecto`. */
export const expresionDe = (puntos, magnitud, porDefecto = 'CORRECCION') => {
  const propios = puntos.filter(punto => punto.magnitud === magnitud);
  if (!propios.length) return porDefecto;
  return propios.some(punto => punto.expresadoComo === 'ERROR') ? 'ERROR' : 'CORRECCION';
};

// ─── Apta según la OIML R111 ─────────────────────────────────────────────────

/**
 * emp (± mg) de la Tabla 1 de la R111 para una clase y un valor nominal, con
 * la tabla que manda el servidor ({ clases, emp: [[nominalMg, ...por clase]] }).
 * null si la clase no tiene ese valor nominal.
 */
export const empR111 = (r111, clase, nominalMg) => {
  const columna = r111?.clases?.indexOf(clase) ?? -1;
  if (columna < 0 || !Number.isFinite(nominalMg)) return null;
  const fila = r111.emp.find(([nominal]) => Math.abs(nominalMg - nominal) <= Math.abs(nominal) * 1e-9);
  return fila?.[columna + 1] ?? null;
};

/**
 * Pieza apta para su clase solo con los valores de su certificado (la misma
 * regla que el servidor, aptaR111): U (k = 2) ≤ emp/3 (R111 5.2) y
 * |corrección| ≤ emp − U (5.3). apta es null si no se puede decidir; `motivo`
 * lo explica en una frase; `condiciones` trae las dos por separado (5.2 y 5.3,
 * con su valor, su límite y si se cumple) para mostrarlas cada una en su
 * columna, y `fallas` las que no se cumplen.
 */
export const aptaPieza = ({ r111, clase, nominalMg, correccion, u, k }) => {
  if (!clase) return { apta: null, motivo: 'Elige la clase del juego para calcularla.' };
  const emp = empR111(r111, clase, nominalMg);
  if (emp == null) return { apta: null, motivo: `La clase ${clase} no tiene este valor nominal (R111, Tabla 1).` };
  const [c, uValor, kValor] = [correccion, u, k].map(parseNumber);
  if (![c, uValor, kValor].every(Number.isFinite) || !(kValor > 0)) {
    return { apta: null, emp, motivo: 'Faltan la corrección, la U o el k.' };
  }
  const u2 = (uValor / kValor) * 2;
  const cumpleU = u2 <= emp / 3 + 1e-12;
  const cumpleCorreccion = Math.abs(c) <= emp - u2 + 1e-12;
  // Para leer: 4 cifras significativas (la decisión usa los valores completos).
  const mg = (valor) => `${formatNumber(Number(valor.toPrecision(4)))} mg`;
  const motivos = [
    `U (k = 2) = ${mg(u2)} ${cumpleU ? '≤' : '>'} emp/3 = ${mg(emp / 3)} (5.2)`,
    `|corrección| = ${mg(Math.abs(c))} ${cumpleCorreccion ? '≤' : '>'} emp − U = ${mg(Math.max(emp - u2, 0))} (5.3)`,
  ];
  // Valores para leer, en mg y con 4 cifras significativas.
  const cifra = valor => formatNumber(Number(valor.toPrecision(4)));
  const condiciones = [
    {
      norma: '5.2',
      cumple: cumpleU,
      valor: cifra(u2),
      limite: cifra(emp / 3),
      detalle: cumpleU
        ? `U (k = 2) = ${mg(u2)} no supera emp/3 = ${mg(emp / 3)}: la incertidumbre alcanza para la clase ${clase}.`
        : `U (k = 2) = ${mg(u2)} supera emp/3 = ${mg(emp / 3)}: la incertidumbre del certificado es grande para la clase ${clase}.`,
    },
    {
      norma: '5.3',
      cumple: cumpleCorreccion,
      valor: cifra(Math.abs(c)),
      limite: cifra(Math.max(emp - u2, 0)),
      detalle: cumpleCorreccion
        ? `|corrección| = ${mg(Math.abs(c))} no supera emp − U = ${mg(Math.max(emp - u2, 0))}: la corrección cabe en la tolerancia.`
        : `|corrección| = ${mg(Math.abs(c))} supera emp − U = ${mg(Math.max(emp - u2, 0))}: la corrección no cabe en la tolerancia.`,
    },
  ];
  const fallas = [
    ...(cumpleU ? [] : [{ norma: '5.2', texto: 'U > emp/3', detalle: `La incertidumbre del certificado (${mg(u2)}) supera emp/3 (${mg(emp / 3)}).` }]),
    ...(cumpleCorreccion ? [] : [{ norma: '5.3', texto: '|corr.| > emp − U', detalle: `La corrección (${mg(Math.abs(c))}) supera emp − U (${mg(Math.max(emp - u2, 0))}).` }]),
  ];
  return {
    apta: cumpleU && cumpleCorreccion, emp, u2, cumpleU, cumpleCorreccion, condiciones, fallas, motivo: `emp ${clase}: ${mg(emp)}. ${motivos.join('; ')}.`,
  };
};

/**
 * La clase más exacta de la R111 que cumple la pieza con los valores de su
 * certificado: recorre las clases en su orden (E1, E2, F1, F2, M1…) y se queda
 * con la primera en la que cumple 5.2 y 5.3 para ese valor nominal. Sirve para
 * saber qué clase respalda el certificado cuando no alcanza la del juego (por
 * ejemplo, una U del laboratorio que no llega a E2 pero sí a F1).
 * { calculable, clase }: calculable es false si faltan la corrección, la U o
 * el k; clase es null si no cumple ninguna.
 */
export const claseQueCumple = ({ r111, nominalMg, correccion, u, k }) => {
  const [c, uValor, kValor] = [correccion, u, k].map(parseNumber);
  if (![c, uValor, kValor].every(Number.isFinite) || !(kValor > 0) || !Number.isFinite(nominalMg)) {
    return { calculable: false, clase: null };
  }
  const clase = (r111?.clases || []).find(candidata => aptaPieza({ r111, clase: candidata, nominalMg, correccion, u, k }).apta === true);
  return { calculable: true, clase: clase ?? null };
};

/** ¿La clase `a` es menos exacta que `b`? (en el orden de la Tabla 1: E1 la más exacta). */
export const claseInferior = (r111, a, b) => {
  const clases = r111?.clases || [];
  return clases.indexOf(a) > clases.indexOf(b) && clases.indexOf(b) >= 0;
};

// ─── Materiales (tabla de densidades del método) ────────────────────────────

const sinAcentos = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Material de la lista para un texto escrito o pegado: el del mismo nombre o,
 * como el cálculo, el primero con una palabra clave contenida en el texto.
 * null si ninguno coincide.
 */
export const materialDeLista = (texto, materiales = []) => {
  const buscado = sinAcentos(texto);
  if (!buscado) return null;
  return materiales.find(m => sinAcentos(m.material) === buscado)
    || materiales.find(m => (m.claves || []).some(clave => sinAcentos(clave) && buscado.includes(sinAcentos(clave))))
    || null;
};

/**
 * Densidad supuesta de un material (R111, Tabla B.7) como la escribe un
 * certificado: valor y U con k = 2 (la tabla del método guarda u con k = 1).
 */
export const densidadSupuestaDe = (material, materiales = []) => {
  const fila = materiales.find(m => m.material === material);
  return fila ? { densidad: fila.rho, densidadU: Number((2 * fila.u).toPrecision(12)), densidadK: 2 } : null;
};

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
