/**
 * Ejecución (6.2) y entrega (6.3) de un RIM en la ficha. El RIM no se edita:
 * cada registro es una versión nueva que el servidor agrega a su historial.
 * Estas funciones arman los formularios, anticipan si un cambio es una
 * corrección (pide motivo) y dejan los valores legibles.
 */
export const ETAPAS_RIM = {
  recibido: { label: 'Recibido', tone: 'neutral' },
  en_ejecucion: { label: 'En ejecución', tone: 'info' },
  concluido: { label: 'Concluido', tone: 'warning' },
  entregado: { label: 'Entregado', tone: 'success' },
};

/** Campos de la ejecución en el orden del formulario 6.2. */
export const CAMPOS_EJECUCION = [
  { campo: 'recepcionSt', label: 'Recibió en S.T.', max: 150, personal: true },
  { campo: 'fechaIngreso', label: 'Fecha de ingreso a S.T.', fecha: true },
  { campo: 'tecnicoAsignado', label: 'Técnico asignado', max: 150, personal: true },
  { campo: 'fechaInicio', label: 'Fecha de inicio', fecha: true },
  { campo: 'fechaInforme', label: 'Fecha de informe', fecha: true },
  { campo: 'fechaConclusion', label: 'Fecha de conclusión', fecha: true },
  { campo: 'nroCotizacion', label: 'N.º de cotización', max: 60 },
  { campo: 'nroInforme', label: 'N.º de informe', max: 60 },
  { campo: 'nroFactura', label: 'N.º de factura', max: 60 },
];

/** Datos de la entrega 6.3 (las firmas van aparte y no se corrigen). */
export const CAMPOS_ENTREGA = [
  { campo: 'recibeNombre', label: 'Recibió (cliente)', max: 150 },
  { campo: 'entregaPor', label: 'Entregó (Métrica)', max: 150, personal: true },
  { campo: 'fechaEntrega', label: 'Fecha de entrega', fecha: true },
  { campo: 'lugarEntrega', label: 'Lugar de entrega', max: 255 },
  { campo: 'observaciones', label: 'Observaciones', max: 1000, largo: true },
];

const CAMPOS = Object.fromEntries([...CAMPOS_EJECUCION, ...CAMPOS_ENTREGA].map(def => [def.campo, def]));

export const etiquetaCampo = (campo) => CAMPOS[campo]?.label || campo;

/** «2026-10-03» → «03/10/2026». */
export const fechaCorta = (fecha) => (fecha ? fecha.split('-').reverse().join('/') : null);

/** Valor de un campo para mostrar; null si está vacío. */
export const valorLegible = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  return CAMPOS[campo]?.fecha ? fechaCorta(valor) : String(valor);
};

/** Fecha «yyyy-mm-dd» de un instante en La Paz. */
export function fechaLaPaz(instante = new Date()) {
  const date = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
}

const limpio = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const valoresDe = (campos, datos) => Object.fromEntries(campos.map(({ campo }) => [campo, datos?.[campo] ?? '']));

/**
 * Valores iniciales del formulario de ejecución: los vigentes o, la primera
 * vez, el técnico asignado en la recepción.
 */
export function valoresEjecucion(rim) {
  const vigente = rim.seguimiento?.ejecucion?.vigente?.datos;
  if (vigente) return valoresDe(CAMPOS_EJECUCION, vigente);
  return { ...valoresDe(CAMPOS_EJECUCION, {}), tecnicoAsignado: rim.recepcion?.tecnicoAsignado || '' };
}

/**
 * Qué cambia respecto de los datos vigentes y qué tipo de versión resulta,
 * igual que en el servidor: registro (la primera), avance (solo completa
 * vacíos) o corrección (cambia o borra un dato registrado; pide motivo).
 */
export function cambiosEjecucion(vigente, valores) {
  const cambios = CAMPOS_EJECUCION
    .map(({ campo }) => ({ campo, antes: limpio(vigente?.[campo]), despues: limpio(valores[campo]) }))
    .filter(cambio => cambio.antes !== cambio.despues);
  let tipo = null;
  if (cambios.length) {
    if (!vigente) tipo = 'registro';
    else tipo = cambios.some(cambio => cambio.antes !== null) ? 'correccion' : 'avance';
  }
  return { tipo, cambios };
}

/** Cuerpo de `POST /api/rim/registros/:n/ejecucion`. */
export function cuerpoEjecucion(valores, { anteriorId, motivo }) {
  return {
    anteriorId: anteriorId ?? null,
    ...Object.fromEntries(CAMPOS_EJECUCION.map(({ campo }) => [campo, limpio(valores[campo])])),
    motivo: limpio(motivo),
  };
}

/**
 * Valores iniciales de la entrega: para registrarla, quien entregó en la
 * recepción, el mismo lugar y la fecha de hoy; para corregirla, los vigentes.
 */
export function valoresEntrega(rim, modo, hoy = fechaLaPaz()) {
  const vigente = rim.seguimiento?.entrega?.vigente?.datos;
  if (modo === 'correccion' && vigente) return valoresDe(CAMPOS_ENTREGA, vigente);
  return {
    recibeNombre: rim.recepcion?.contactoNombre || '',
    entregaPor: '',
    fechaEntrega: hoy,
    lugarEntrega: rim.recepcion?.lugar || '',
    observaciones: '',
  };
}

export function cambiosEntrega(vigente, valores) {
  return CAMPOS_ENTREGA
    .map(({ campo }) => ({ campo, antes: limpio(vigente?.[campo]), despues: limpio(valores[campo]) }))
    .filter(cambio => cambio.antes !== cambio.despues);
}

/**
 * Cuerpo de `POST /api/rim/registros/:n/entrega` según la acción: registro
 * (con las dos firmas), corrección (sin firmas: se conservan) o anulación.
 */
export function cuerpoEntrega(accion, valores, { anteriorId, firmas, motivo }) {
  const base = { accion, anteriorId: anteriorId ?? null };
  if (accion === 'anulacion') return { ...base, motivo: limpio(motivo) };
  const datos = Object.fromEntries(CAMPOS_ENTREGA.map(({ campo }) => [campo, limpio(valores[campo])]));
  if (accion === 'correccion') return { ...base, ...datos, motivo: limpio(motivo) };
  return { ...base, ...datos, firmaCliente: firmas?.cliente ?? null, firmaRepresentante: firmas?.representante ?? null };
}

/** Los vehículos del Cronograma vienen en la misma lista, con el área VEHICULOS. */
const esVehiculo = (recurso) => String(recurso?.area || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase() === 'VEHICULOS';

/** Nombres del personal activo (sin vehículos), sin repetir, para sugerir. */
export function nombresPersonal(recursos = []) {
  const nombres = recursos
    .filter(recurso => !esVehiculo(recurso))
    .map(recurso => String(recurso.nombre || '').trim())
    .filter(Boolean);
  return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'));
}

/** «Ana Quispe (aquispe)» o solo el usuario. */
export const quien = (version) => (version?.usuarioNombre
  ? `${version.usuarioNombre} (${version.usuario})`
  : version?.usuario || null);
