// Servicios de calibración que subió ServiceMET (fase 2): filtros, grupos por
// SECA y etiquetas. El modelo y los avisos los arma el servidor
// (calibration.fuente.js); aquí solo se ordena lo que se muestra.

import { matchesQuery } from './format';
import { formatNumber } from './patrones';

export const NIVELES = {
  error: { label: 'Error', plural: 'errores', tone: 'danger', descripcion: 'Impide calcular el certificado.' },
  aviso: { label: 'Aviso', plural: 'avisos', tone: 'warning', descripcion: 'Conviene revisarlo antes de elaborar el registro.' },
  info: { label: 'Nota', plural: 'notas', tone: 'info', descripcion: 'Se corrigió solo o es informativo.' },
};

// Filtros por calidad de los datos (chips de la lista).
export const CALIDADES = {
  CON_ERRORES: {
    label: 'Con errores',
    tone: 'danger',
    descripcion: 'Les falta algo para poder calcular (fecha, ensayos, pesas, unidad…).',
    cumple: servicio => servicio.avisos.errores > 0,
  },
  CON_AVISOS: {
    label: 'Con avisos',
    tone: 'warning',
    descripcion: 'Sin errores, pero con algo que revisar.',
    cumple: servicio => servicio.avisos.errores === 0 && servicio.avisos.avisos > 0,
  },
  SIN_TECNICO: {
    label: 'Técnico sin identificar',
    tone: 'warning',
    descripcion: 'ServiceMET no envió un técnico reconocible («Usuario», «Usuario sin datos»).',
    cumple: servicio => !servicio.tecnico.usuario,
  },
  LIMPIOS: {
    label: 'Sin observaciones',
    tone: 'success',
    descripcion: 'Sin errores ni avisos.',
    cumple: servicio => servicio.avisos.errores === 0 && servicio.avisos.avisos === 0,
  },
};

// Secciones del detalle en el orden del registro (RECA).
export const SECCIONES = [
  { id: 'servicio', label: 'Servicio' },
  { id: 'instrumento', label: 'Cliente e instrumento' },
  { id: 'patrones', label: 'Patrones' },
  { id: 'ambiente', label: 'Condiciones del lugar' },
  { id: 'ajuste', label: 'Precarga y ajuste' },
  { id: 'excentricidad', label: 'Excentricidad' },
  { id: 'repetibilidad', label: 'Repetibilidad' },
  { id: 'errores', label: 'Error de indicación' },
  { id: 'criterio', label: 'Criterio y cierre' },
];

/**
 * Sección del detalle donde se muestra un aviso. Los avisos de los
 * termohigrómetros van con los patrones; los de los puntos acordados, con el
 * error de indicación.
 */
export const seccionDeAviso = (aviso) => {
  if (aviso.seccion === 'ambiente' && /^(PATRON_|SIN_TERMOHIGROMETRO)/.test(aviso.codigo)) return 'patrones';
  if (aviso.seccion === 'acordado') return 'errores';
  if (aviso.seccion === 'cliente') return 'instrumento';
  return SECCIONES.some(seccion => seccion.id === aviso.seccion) ? aviso.seccion : 'servicio';
};

export const ORDEN_NIVEL = { error: 0, aviso: 1, info: 2 };
export const ordenarAvisos = (avisos) => [...avisos].sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]);

export const VALORES_PATRON = {
  VERIFICADOS: { label: 'Verificados', tone: 'success' },
  SIN_VERIFICAR: { label: 'Sin verificar', tone: 'warning' },
  SIN_VALORES: { label: 'Sin valores', tone: 'warning' },
};

export const ESTADO_PATRON = {
  VIGENTE: { label: 'Vigente', tone: 'success' },
  SIN_CERTIFICADO: { label: 'Sin certificado vigente', tone: 'danger' },
  NO_EXISTE: { label: 'No está en el gestor', tone: 'danger' },
};

export const METODOS = {
  EVALUANDO_CEROS: 'Ascenso evaluando ceros',
  CONTINUO: 'Ascenso continuo por pasos',
  SIN_METODO: 'Sin método indicado',
};

export const METODOS_CARGA = {
  NINGUNO: 'Sin sustitución',
  METODO_1: 'Sustitución, método 1',
  METODO_2: 'Sustitución, método 2',
};

export const REGLAS = { NINGUNA: 'Ninguna', SIMPLE: 'Simple', CONSERVADORA: 'Conservadora' };

export const TIPOS_AJUSTE = { EXTERNO: 'Externo', INTERNO: 'Interno', NO_APLICA: 'No aplica' };

export const ORIGENES_ACORDADOS = {
  ICLI: 'Access (ICLI)',
  LEC: 'DATA_SERVICIOS_LEC',
  DATAMET: 'DataMET+',
};

/** Número con coma decimal; vacío → «—». */
export const numero = (valor) => (valor == null ? '—' : formatNumber(valor));

export const conUnidad = (valor, unidad) => (valor == null ? '—' : `${formatNumber(valor)}${unidad ? ` ${unidad}` : ''}`);

export const instrumentoTexto = (instrumento) => [instrumento.tipo, instrumento.marca, instrumento.modelo]
  .filter(Boolean).join(' · ');

/** Filtra por texto, técnico y calidad de los datos. */
export const filtrarServicios = (servicios, { q = '', tecnico = '', calidad = '' } = {}) => servicios.filter(servicio => (
  (!tecnico || servicio.tecnico.usuario === tecnico)
  && (!calidad || CALIDADES[calidad]?.cumple(servicio))
  && matchesQuery(
    q,
    servicio.codigo, servicio.seca, servicio.secaLibro, servicio.reca, servicio.sticker, servicio.cliente,
    servicio.razonSocial, servicio.planta, servicio.tecnico.original, servicio.tecnico.nombre,
    servicio.instrumento.codigoMetrica, servicio.instrumento.codigoInterno, servicio.instrumento.marca,
    servicio.instrumento.modelo, servicio.instrumento.serie,
  )
));

/** Cuántos servicios cumplen cada filtro de calidad. */
export const contarCalidades = (servicios) => Object.fromEntries(
  Object.entries(CALIDADES).map(([clave, calidad]) => [clave, servicios.filter(calidad.cumple).length]),
);

const unicos = (valores) => [...new Set(valores.filter(Boolean))];

/**
 * Servicios agrupados por SECA (como lo usa el libro: «0051-C01-26»), del
 * grupo con el servicio más reciente al más antiguo; dentro, por n.º de RECA.
 */
export const agruparPorSeca = (servicios) => {
  const grupos = new Map();
  for (const servicio of servicios) {
    const clave = servicio.secaLibro || servicio.seca || 'Sin SECA';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(servicio);
  }
  return [...grupos.entries()].map(([clave, lista]) => {
    const fechas = lista.map(s => s.fecha).filter(Boolean).sort();
    return {
      clave,
      clientes: unicos(lista.map(s => s.cliente)),
      plantas: unicos(lista.map(s => s.planta)),
      tecnicos: unicos(lista.map(s => s.tecnico.iniciales || s.tecnico.nombre)),
      desde: fechas[0] || null,
      hasta: fechas[fechas.length - 1] || null,
      total: lista.length,
      conErrores: lista.filter(s => s.avisos.errores > 0).length,
      conAvisos: lista.filter(s => s.avisos.errores === 0 && s.avisos.avisos > 0).length,
      servicios: [...lista].sort((a, b) => (Number(a.reca) || 0) - (Number(b.reca) || 0) || String(a.codigo).localeCompare(String(b.codigo))),
    };
  }).sort((a, b) => String(b.hasta || '').localeCompare(String(a.hasta || '')) || a.clave.localeCompare(b.clave));
};

/** Técnicos reconocidos en la lista, para el filtro. */
export const tecnicosDe = (servicios) => {
  const porUsuario = new Map();
  for (const servicio of servicios) {
    if (servicio.tecnico.usuario && !porUsuario.has(servicio.tecnico.usuario)) {
      porUsuario.set(servicio.tecnico.usuario, servicio.tecnico.nombre || servicio.tecnico.usuario);
    }
  }
  return [...porUsuario.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Cargas escritas por el usuario: separadas por punto y coma, tabulador,
 * espacio o salto de línea (pegadas de Excel), con coma o punto decimal.
 * Devuelve { cargas, invalidas }.
 */
export const leerCargas = (texto, parseNumber) => {
  const partes = String(texto ?? '').split(/[;\t\n\r ]+/).map(parte => parte.trim()).filter(Boolean);
  const cargas = [];
  const invalidas = [];
  for (const parte of partes) {
    const valor = parseNumber(parte);
    if (valor == null || Number.isNaN(valor) || valor <= 0) invalidas.push(parte);
    else cargas.push(valor);
  }
  return { cargas, invalidas };
};
