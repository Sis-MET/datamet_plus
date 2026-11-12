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

// Opciones de las reglas de cálculo (todas programadas y probadas en el motor;
// la primera es la de la versión 1).
export const REPETIBILIDAD = [
  { value: 'ENCIERRAN', label: 'Ensayos que encierran la carga', descripcion: 'La mayor de las dos s de los ensayos más cercanos por debajo y por encima de cada carga (EURAMET 7.1.1).' },
  { value: 'MAYOR', label: 'La mayor de todos', descripcion: 'La mayor s de todos los ensayos, en todo el rango, como el libro F-VMET-02-7.2. Más conservadora: sube U en las cargas bajas.' },
];
export const COBERTURA = [
  { value: 'T_STUDENT', label: 't de Student (νeff)', descripcion: 'k para la probabilidad de cobertura con los grados efectivos de libertad (EURAMET 7.3 y Anexo B): sube cuando la repetibilidad tiene pocas lecturas.' },
  { value: 'FIJO', label: 'k fijo', descripcion: 'El mismo k en todos los puntos, sin mirar νeff. EURAMET lo admite solo si u(E) es fiable (muchas lecturas).' },
];
export const CIFRAS_U = [
  { value: 1, label: '1 cifra' },
  { value: 2, label: '2 cifras', descripcion: 'Lo habitual (GUM 7.2.6).' },
  { value: 3, label: '3 cifras' },
];
export const SENTIDO_U = [
  { value: 'ARRIBA', label: 'Hacia arriba', descripcion: 'Nunca declara una U menor que la calculada (GUM 7.2.6 lo admite).' },
  { value: 'CERCANO', label: 'Al más cercano', descripcion: 'Redondeo común: la mitad sube.' },
];
export const AIRE = [
  { value: 'CIPM-2007', label: 'CIPM-2007', descripcion: 'Fórmula completa (EURAMET A1.1), con incertidumbre relativa de 2,2·10⁻⁵.' },
  { value: 'APROXIMADA', label: 'Aproximada', descripcion: 'Fórmula simplificada (EURAMET A1.1-1, OIML R111 E.3-1), con 2,4·10⁻⁴; pensada para 600–1 100 hPa y 15–27 °C.' },
];
export const EXCENTRICIDAD = [
  { value: 'METODO_3', label: 'Método 3', descripcion: 'Se vuelve a cero entre posiciones y se resta el retorno (EURAMET 5.3 y 6.3-2).' },
  { value: 'METODO_1', label: 'Método 1', descripcion: 'Diferencia directa con el centro, sin restar el retorno a cero (EURAMET 6.3-1).' },
];
export const CLASE_SUGERIDA = [
  { value: 'TABLA_3', label: 'Tabla 3 de la R76', descripcion: 'La clase que admiten e y n = Max/e de todos los rangos; si admiten varias, la de menor exactitud.' },
  { value: 'POR_N', label: 'Solo por n', descripcion: 'Como el libro: por n = Max/e del rango mayor (hasta 1 000: IIII; 10 000: III; 100 000: II; más: I).' },
];

/** Criterio de aptitud de las pesas patrón (el mismo que el backend: motor.CRITERIOS_APTITUD_PESAS). */
export const APTITUD_PESAS = [
  { value: 'R111', label: 'OIML R111 (5.2 y 5.3)', descripcion: 'Apta si U (k = 2) ≤ emp/3 y |corrección| ≤ emp − U. Es lo que pide la R111 para declarar la clase.' },
  { value: 'SUMA_EMP', label: 'Criterio del laboratorio: |corrección| + U ≤ emp', descripcion: 'Solo avisa si la corrección más la U supera el emp de la clase. La comparación con emp/3 (5.2) se sigue mostrando como dato, sin aviso; útil cuando ningún laboratorio del país reporta U ≤ emp/3.' },
];

/** Decimales del error y de U en el certificado (motor.DECIMALES_RESULTADO). */
export const DECIMALES_RESULTADO = [
  { value: 'POR_U', label: 'Por la incertidumbre', descripcion: 'U con sus cifras significativas (las de arriba) y el error con los mismos decimales que U (GUM 7.2.6).' },
  { value: 'POR_RANGO', label: 'Por el rango de la carga', descripcion: 'El error con los decimales del rango al que corresponde la carga (los que declara ServiceMET) y U con un decimal más, redondeada en el sentido de arriba.' },
];

/** Cómo se escribe el factor de cobertura (motor.FORMATOS_K). */
export const FORMATOS_K = [
  { value: 'DOS_DECIMALES', label: 'Con dos decimales', descripcion: 'k = 2,00.' },
  { value: 'SIN_DECIMALES', label: 'Sin decimales', descripcion: 'k = 2. Si k no es entero (t de Student con pocas lecturas), con los suyos: 2,05.' },
];

/** Cómo se calcula el riesgo asociado (motor.METODOS_RIESGO). */
export const RIESGO = [
  { value: 'DOS_COLAS', label: 'Normal con u = U/k, dos colas', descripcion: 'Probabilidad de que el error real quede fuera de ±T, con una normal de media E y desviación u = U/k (JCGM 106).' },
  { value: 'PLANILLA', label: 'Como la planilla del laboratorio', descripcion: '1 − Φ((T − |E|) / U) con el error y la U que se informan: una cola y la U expandida como desviación. Da riesgos mayores.' },
];

export const EMPUJE = [
  { value: '5b', label: '7.1.2-5b', descripcion: 'Con la densidad del aire de la calibración de las pesas (ρa1) cuando se conoce; más exacta en altura.' },
  { value: '5a', label: '7.1.2-5a', descripcion: 'Solo con la densidad del aire y de la pesa.' },
];

// Límites (los mismos del backend) y unidad de cada número; `escala` convierte
// lo que se escribe en lo que se guarda (p. ej. % → fracción).
export const NUMEROS = {
  'parametros.cobertura.probabilidad': { min: 0.9, max: 0.999, escala: 0.01, unidad: '%' },
  'parametros.cobertura.k': { min: 1, max: 4 },
  'parametros.conformidad.bandaGuarda': { min: 0, max: 3, unidad: '× U' },
  'parametros.conformidad.riesgoUmbral': { min: 0.001, max: 0.5, escala: 0.01, unidad: '%' },
  'parametros.empServicio.factor': { min: 1, max: 3, unidad: '× emp de verificación' },
  'parametros.usp.tolerancia': { min: 0.0001, max: 0.05, escala: 0.01, unidad: '%' },
  'parametros.usp.cargaEvaluacion': { min: 0.001, max: 1, escala: 0.01, unidad: '% de Max' },
  'parametros.usp.sMinimaEnD': { min: 0, max: 2, unidad: '× d' },
  'parametros.usp.factorS': { min: 1, max: 4, unidad: '× s' },
  'parametros.usp.divisorPesas': { min: 1, max: 10 },
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
  'parametros.repetibilidad.regla': 'Regla: s de repetibilidad en cada carga',
  'parametros.cobertura.metodo': 'Regla: cálculo de k',
  'parametros.cobertura.probabilidad': 'Regla: probabilidad de cobertura',
  'parametros.cobertura.k': 'Regla: k fijo',
  'parametros.redondeoU.cifras': 'Regla: cifras de U',
  'parametros.redondeoU.sentido': 'Regla: redondeo de U',
  'parametros.aire.formula': 'Regla: fórmula del aire',
  'parametros.excentricidad.metodo': 'Regla: método de excentricidad',
  'parametros.conformidad.bandaGuarda': 'Regla conservadora: banda de guarda',
  'parametros.conformidad.riesgoUmbral': 'Riesgo: umbral que se escribe «menor que»',
  'parametros.conformidad.riesgo': 'Regla: cálculo del riesgo asociado',
  'parametros.presentacion.decimales': 'Regla: decimales del error y de U',
  'parametros.presentacion.k': 'Regla: formato del factor de cobertura',
  'parametros.empServicio.factor': 'emp en servicio: factor',
  'parametros.claseSugerida.regla': 'Regla: clase sugerida',
  'parametros.usp.tolerancia': 'USP: tolerancia',
  'parametros.usp.cargaEvaluacion': 'USP: carga de evaluación',
  'parametros.usp.sMinimaEnD': 'USP: s mínima',
  'parametros.usp.factorS': 'USP: factor de s',
  'parametros.usp.divisorPesas': 'USP: divisor para las pesas',
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
  'parametros.pesas.aptitud': 'Regla: aptitud de las pesas patrón',
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

// Nombres de las opciones para leer las diferencias («ENCIERRAN» → «Ensayos que encierran la carga»).
const NOMBRES_OPCION = Object.fromEntries([REPETIBILIDAD, COBERTURA, SENTIDO_U, AIRE, EXCENTRICIDAD, CLASE_SUGERIDA, APTITUD_PESAS, DECIMALES_RESULTADO, FORMATOS_K, RIESGO]
  .flat().map(o => [o.value, o.label]));

/** Valor para leer en una diferencia; con la ruta, en la unidad en que se escribe. */
export const textoValor = (valor, ruta = null) => {
  if (valor == null) return 'vacío';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'string' && NOMBRES_OPCION[valor]) return NOMBRES_OPCION[valor];
  const regla = ruta ? NUMEROS[rutaGenerica(ruta)] : null;
  if (typeof valor === 'number' && regla?.escala) return `${escribirNumero(Number((valor / regla.escala).toPrecision(12)))} ${regla.unidad}`;
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  if (Array.isArray(valor)) return valor.length ? valor.map(v => textoValor(v)).join('; ') : 'ninguno';
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
      // Los límites en la unidad en que se escriben (p. ej. % y no fracción).
      const limite = v => escribirNumero(regla.escala ? Number((v / regla.escala).toPrecision(12)) : v);
      if (typeof valor !== 'number' || !Number.isFinite(valor)) problemas[ruta] = 'Debe ser un número.';
      else if (valor < regla.min) problemas[ruta] = `Debe ser al menos ${limite(regla.min)}.`;
      else if (valor > regla.max) problemas[ruta] = `Debe ser como máximo ${limite(regla.max)}.`;
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

/**
 * Avisos de coherencia entre las reglas y los textos del certificado (no
 * impiden guardar): el texto «Incertidumbre» debe decir lo que se calcula.
 */
export const avisosMetodo = (contenido) => {
  const p = contenido?.parametros;
  const texto = String(contenido?.textos?.incertidumbre || '');
  if (!p?.cobertura) return [];
  const avisos = [];
  if (p.cobertura.metodo === 'FIJO') {
    if (/student|grados efectivos/i.test(texto)) avisos.push('El texto «Incertidumbre» del certificado habla de la t de Student y los grados efectivos de libertad, pero k es fijo: corrígelo en «Textos del certificado».');
  } else {
    const probabilidad = escribirNumero(Number((p.cobertura.probabilidad * 100).toPrecision(12)));
    // El número completo: «95» no está dentro de «95,45».
    const mencion = new RegExp(`(^|[^0-9,])${probabilidad}(?![0-9]|,[0-9])`);
    if (!mencion.test(texto)) avisos.push(`El texto «Incertidumbre» del certificado no menciona el ${probabilidad} % de probabilidad de cobertura: corrígelo en «Textos del certificado».`);
  }
  return avisos;
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
