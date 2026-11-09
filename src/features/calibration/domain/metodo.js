/**
 * Configuración del método por versiones (fase 6): etiquetas, diferencias y
 * validación en la pantalla Calibración > Método. El backend vuelve a validar
 * (calibration.metodo.js) con los mismos límites.
 */

export const ESTADOS_VERSION = {
  BORRADOR: { label: 'Borrador', tone: 'warning' },
  VIGENTE: { label: 'Vigente', tone: 'success' },
  REEMPLAZADA: { label: 'Reemplazada', tone: 'muted' },
  DESCARTADA: { label: 'Descartada', tone: 'muted' },
};

export const ACCIONES_METODO = {
  CREACION: 'Borrador creado',
  EDICION: 'Borrador editado',
  APROBACION: 'Aprobada',
  DESCARTE: 'Borrador descartado',
};

export const CLASES_PESAS = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'];

// Lo que no se edita aquí (decisiones de la fase 0, validadas con el motor).
export const FIJOS = [
  { clave: 'cobertura', etiqueta: 'Probabilidad de cobertura', texto: () => '95,45 % (k por νeff, t de Student)' },
  { clave: 'redondeoU', etiqueta: 'Redondeo de U', texto: () => 'Dos cifras significativas, hacia arriba; el error al mismo decimal' },
  { clave: 'formulaAire', etiqueta: 'Densidad del aire', texto: valor => (valor === 'CIPM-2007' ? 'CIPM-2007 (EURAMET A1.1)' : valor) },
  { clave: 'excentricidad', etiqueta: 'Excentricidad', texto: () => 'Método 3: se vuelve a cero entre posiciones (EURAMET 5.3)' },
  { clave: 'reglaConservadora', etiqueta: 'Regla conservadora', texto: () => '|E| + U(E) ≤ T' },
];

export const EMPUJE = [
  { value: '5b', label: '7.1.2-5b', descripcion: 'Con la densidad del aire de la calibración de las pesas (ρa1) cuando se conoce; más exacta en altura.' },
  { value: '5a', label: '7.1.2-5a', descripcion: 'Solo con la densidad del aire y de la pesa.' },
];

// Límites (los mismos del backend) y unidad de cada número.
export const NUMEROS = {
  'parametros.kD': { min: 1, max: 3 },
  'parametros.conveccion.porEstabilizacion[].deltaT': { min: 0, max: 20, unidad: 'K' },
  'parametros.conveccion.deltaTSinDato': { min: 0, max: 20, unidad: 'K' },
  'parametros.avisos.excentricidadEnD': { min: 0.1, max: 100, unidad: '× d' },
  'parametros.avisos.lecturaVsCargaEnD': { min: 0.1, max: 100, unidad: '× d' },
  'parametros.avisos.uEnD': { min: 0.1, max: 100, unidad: '× d' },
  'parametros.enUso.k': { min: 1, max: 3 },
  'parametros.enUso.deltaT': { min: 0, max: 50, unidad: 'K' },
  'parametros.enUso.kT': { min: 0, max: 0.001, unidad: '1/K', vacio: true },
  'parametros.enUso.factorKT': { min: 1, max: 10 },
  'parametros.densidades[].rho': { min: 500, max: 25000, unidad: 'kg/m³' },
  'parametros.densidades[].u': { min: 0, max: 2000, unidad: 'kg/m³' },
};

// Listas de números; `escala` convierte lo que se escribe (p. ej. % → fracción).
export const LISTAS = {
  'parametros.enUso.fracciones': { min: 0.001, max: 1, largo: 12, escala: 0.01, unidad: '% de Max' },
  'parametros.pesadaMinima.exactitudes': { min: 0.0001, max: 0.5, largo: 10, escala: 0.01, unidad: '%' },
  'parametros.pesadaMinima.factores': { min: 1, max: 20, largo: 10, escala: 1, unidad: '' },
};

const TEXTOS = {
  'textos.metodo': ['Método', 1000],
  'textos.fechaEmision': ['Fecha de emisión', 300],
  'textos.alcanceNota': ['Nota del alcance', 300],
  'textos.leyenda[]': ['Leyenda', 1500],
  'textos.pruebasConExcentricidad': ['Pruebas (con excentricidad)', 600],
  'textos.pruebasSinExcentricidad': ['Pruebas (sin excentricidad)', 600],
  'textos.pruebas[]': ['Frase de las pruebas', 600],
  'textos.sustitucion': ['Cargas de sustitución', 600],
  'textos.incertidumbre': ['Incertidumbre', 1500],
  'textos.repetibilidad': ['Repetibilidad', 300],
  'textos.reglas.SIMPLE': ['Regla simple', 1500],
  'textos.reglas.CONSERVADORA': ['Regla conservadora', 1500],
  'textos.reglas.NINGUNA': ['Sin declaración de conformidad', 300],
  'textos.datosCliente': ['Datos del cliente', 600],
};
export const LARGO_TEXTO = Object.fromEntries(Object.entries(TEXTOS).map(([ruta, [, largo]]) => [ruta, largo]));

const ETIQUETAS = {
  'parametros.empuje': 'Incertidumbre del empuje',
  'parametros.kD': 'Factor de deriva kD',
  'parametros.conveccion.activa': 'Convección: se aplica',
  'parametros.conveccion.clases': 'Convección: clases de pesas',
  'parametros.conveccion.clases[]': 'Convección: clase',
  'parametros.conveccion.porEstabilizacion': 'Convección: ΔT por estabilización',
  'parametros.conveccion.porEstabilizacion[].texto': 'Convección: estabilización',
  'parametros.conveccion.porEstabilizacion[].deltaT': 'Convección: ΔT',
  'parametros.conveccion.deltaTSinDato': 'Convección: ΔT sin dato',
  'parametros.avisos.excentricidadEnD': 'Aviso de excentricidad',
  'parametros.avisos.lecturaVsCargaEnD': 'Aviso de lectura frente a la carga',
  'parametros.avisos.uEnD': 'Aviso de incertidumbre',
  'parametros.enUso.k': 'En uso: k',
  'parametros.enUso.deltaT': 'En uso: ΔT del lugar',
  'parametros.enUso.kT': 'En uso: coeficiente de temperatura',
  'parametros.enUso.factorKT': 'En uso: factor del coeficiente',
  'parametros.enUso.fracciones[]': 'En uso: carga de la tabla',
  'parametros.pesadaMinima.exactitudes[]': 'Pesada mínima: exactitud',
  'parametros.pesadaMinima.factores[]': 'Pesada mínima: factor de seguridad',
  'parametros.densidades': 'Densidades por material',
  'parametros.densidades[].material': 'Densidad: material',
  'parametros.densidades[].claves': 'Densidad: palabras clave',
  'parametros.densidades[].claves[]': 'Densidad: palabra clave',
  'parametros.densidades[].rho': 'Densidad: ρ',
  'parametros.densidades[].u': 'Densidad: u(ρ)',
  ...Object.fromEntries(Object.entries(TEXTOS).map(([ruta, [etiqueta]]) => [ruta, `Texto: ${etiqueta.toLowerCase()}`])),
};

/** Ruta sin índices: parametros.densidades[2].rho → parametros.densidades[].rho. */
export const rutaGenerica = ruta => ruta.replace(/\[\d+\]/g, '[]');

/** Etiqueta de una ruta con la fila, p. ej. «Densidad: ρ · fila 3». */
export const etiquetaRuta = (ruta) => {
  const generica = rutaGenerica(ruta);
  const filas = [...ruta.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]) + 1);
  const etiqueta = ETIQUETAS[generica] || ETIQUETAS[generica.replace(/\[\]$/, '')] || ruta;
  // En listas de valores sueltos (clases, palabras clave) la fila sobra.
  const conFila = filas.length && !/\.(clases|claves)\[\]$/.test(generica) && !/(fracciones|exactitudes|factores)\[\]$/.test(generica);
  return conFila ? `${etiqueta} · fila ${filas[0]}` : etiqueta;
};

/** Valor para leer en una diferencia. */
export const textoValor = (valor) => {
  if (valor == null) return 'vacío';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  if (Array.isArray(valor)) return valor.length ? valor.map(textoValor).join('; ') : 'ninguno';
  return String(valor);
};

/** Rutas con su valor (a.b[0].c). */
export const aplanar = (valor, ruta = '', salida = {}) => {
  if (Array.isArray(valor)) {
    if (!valor.length) salida[ruta] = [];
    valor.forEach((v, i) => aplanar(v, `${ruta}[${i}]`, salida));
  } else if (valor && typeof valor === 'object') {
    Object.entries(valor).forEach(([clave, v]) => aplanar(v, ruta ? `${ruta}.${clave}` : clave, salida));
  } else {
    salida[ruta] = valor;
  }
  return salida;
};

/** Diferencias entre dos contenidos: [{ ruta, antes, despues }]. */
export const diferencias = (antes, despues) => {
  const a = aplanar(antes || {});
  const d = aplanar(despues || {});
  return [...new Set([...Object.keys(a), ...Object.keys(d)])]
    .filter(ruta => JSON.stringify(a[ruta]) !== JSON.stringify(d[ruta]))
    .map(ruta => ({ ruta, antes: a[ruta] ?? null, despues: d[ruta] ?? null }));
};

/** ¿Alguna diferencia toca esta ruta (o algo debajo de ella)? */
export const tocaRuta = (lista, ruta) => lista.some(d => d.ruta === ruta || d.ruta.startsWith(`${ruta}.`) || d.ruta.startsWith(`${ruta}[`));

/** Número escrito con coma o punto; null si está vacío; NaN si no se lee. */
export const leerNumero = (texto) => {
  const limpio = String(texto ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!limpio) return null;
  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(limpio) ? Number(limpio) : Number.NaN;
};

export const escribirNumero = valor => (valor == null || Number.isNaN(valor) ? '' : String(Number(valor.toPrecision(12))).replace('.', ','));

/** Lista «1; 5; 10» (con su escala) → [0,01, 0,05, 0,1]; null si algo no se lee. */
export const leerLista = (texto, escala = 1) => {
  const partes = String(texto ?? '').split(/[;\n]/).map(p => p.trim()).filter(Boolean);
  const numeros = partes.map(leerNumero);
  if (numeros.some(n => n == null || Number.isNaN(n))) return null;
  return numeros.map(n => Number((n * escala).toPrecision(12)));
};

export const escribirLista = (lista, escala = 1) => (lista || []).map(n => escribirNumero(Number((n / escala).toPrecision(12)))).join('; ');

/**
 * Problemas del contenido antes de guardar: { ruta: mensaje }. Mismos límites
 * que el backend; los textos no pueden quedar vacíos.
 */
export const validar = (contenido) => {
  const problemas = {};
  const valores = aplanar(contenido || {});
  for (const [ruta, valor] of Object.entries(valores)) {
    const generica = rutaGenerica(ruta);
    // Listas vacías: solo importan las que piden al menos un valor (abajo).
    if (Array.isArray(valor)) {
      if (generica === 'parametros.densidades[].claves') problemas[ruta] = 'Hace falta al menos una palabra clave.';
      continue;
    }
    const regla = NUMEROS[generica];
    if (regla) {
      if (valor == null && regla.vacio) continue;
      if (typeof valor !== 'number' || !Number.isFinite(valor)) problemas[ruta] = 'Debe ser un número.';
      else if (valor < regla.min) problemas[ruta] = `Debe ser al menos ${escribirNumero(regla.min)}.`;
      else if (valor > regla.max) problemas[ruta] = `Debe ser como máximo ${escribirNumero(regla.max)}.`;
      continue;
    }
    const lista = LISTAS[generica.replace(/\[\]$/, '')];
    if (lista && typeof valor === 'number' && (valor < lista.min || valor > lista.max)) {
      problemas[ruta.replace(/\[\d+\]$/, '')] = `Cada valor entre ${escribirNumero(lista.min / lista.escala)} y ${escribirNumero(lista.max / lista.escala)}.`;
      continue;
    }
    const largo = LARGO_TEXTO[generica];
    if (largo != null || /^textos\./.test(ruta) || /\.(material|texto)$/.test(generica) || /\.claves\[\]$/.test(generica)) {
      const texto = String(valor ?? '').trim();
      if (!texto) problemas[ruta] = 'No puede quedar vacío.';
      else if (largo && texto.length > largo) problemas[ruta] = `Admite hasta ${largo} caracteres.`;
    }
  }
  for (const [ruta, regla] of Object.entries(LISTAS)) {
    const lista = ruta.split('.').reduce((o, k) => o?.[k], contenido);
    if (Array.isArray(lista) && !lista.length) problemas[ruta] = 'Hace falta al menos un valor.';
    else if (Array.isArray(lista) && lista.length > regla.largo) problemas[ruta] = `Admite hasta ${regla.largo} valores.`;
  }
  if (contenido?.parametros?.densidades && !contenido.parametros.densidades.length) problemas['parametros.densidades'] = 'Hace falta al menos un material.';
  return problemas;
};

/** Lee y escribe un valor por ruta (inmutable). */
export const leerRuta = (objeto, ruta) => ruta.split(/\.|\[(\d+)\]/).filter(Boolean).reduce((o, k) => o?.[k], objeto);
export const conRuta = (objeto, ruta, valor) => {
  const claves = ruta.split(/\.|\[(\d+)\]/).filter(Boolean);
  const copia = structuredClone(objeto);
  let nodo = copia;
  claves.slice(0, -1).forEach((clave) => { nodo = nodo[clave]; });
  nodo[claves.at(-1)] = valor;
  return copia;
};
